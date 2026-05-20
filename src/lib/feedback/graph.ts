/**
 * LangGraph-based Feedback Flow
 *
 * Uses LangGraph's StateGraph with proper conditional edges.
 * The graph is self-contained: each node transitions to the next
 * based on state, with no external executor loop required.
 *
 * Flow: START → askRating ──(conditional)──→ [validateRating | askRating (re-ask)]
 *        validateRating ──(conditional)──→ [askFeedback | askRating (invalid)]
 *        askFeedback ──(conditional)──→ [captureAndSend | askFeedback (re-ask)]
 *        captureAndSend ──(conditional)──→ [thankYou | askFeedback (re-ask) | askRating (email fail)]
 *        thankYou → END
 */

import { Annotation, StateGraph, END, START, MemorySaver } from "@langchain/langgraph";
import { sendFeedbackEmail } from "./smtp";

// ─── State Definition ───────────────────────────────────────────────────────

const FeedbackState = Annotation.Root({
  step: Annotation<string>,
  userInput: Annotation<string>,
  rating: Annotation<number | null>,
  feedback: Annotation<string>,
  botMessage: Annotation<string>,
  error: Annotation<string>,
  emailSent: Annotation<boolean>,
  retryCount: Annotation<number>,
});

export type FeedbackStateType = typeof FeedbackState.State;

// ─── Conditional Routing Functions ────────────────────────────────────────────

function routeFromAskRating(state: FeedbackStateType): "validateRating" | "askRating" {
  if (state.step === "INIT" || state.step === "EMAIL_FAILED") {
    return "askRating";
  }
  return "validateRating";
}

function routeFromValidateRating(state: FeedbackStateType): "askFeedback" | "askRating" {
  if (state.step === "RATING_INVALID") {
    return "askRating";
  }
  return "askFeedback";
}

function routeFromAskFeedback(state: FeedbackStateType): "captureAndSend" | "askFeedback" {
  if (state.step === "FEEDBACK_INVALID") {
    return "askFeedback";
  }
  return "captureAndSend";
}

function routeFromCaptureAndSend(state: FeedbackStateType): "thankYou" | "askFeedback" | "askRating" {
  if (state.step === "FEEDBACK_INVALID") {
    return "askFeedback";
  }
  if (state.step === "EMAIL_FAILED") {
    return "askRating";
  }
  return "thankYou";
}

// ─── Graph Nodes ────────────────────────────────────────────────────────────

function askRating(state: FeedbackStateType): Partial<FeedbackStateType> {
  if (state.step === "RATING_INVALID") {
    return {
      step: "RATING_INVALID",
      botMessage:
        "That doesn't look like a valid rating. Please enter a whole number between 1 and 10.",
      error: "INVALID_RATING",
      rating: null,
      feedback: "",
      emailSent: false,
    };
  }

  if (state.step === "EMAIL_FAILED") {
    return {
      step: "EMAIL_FAILED",
      botMessage:
        "Sorry, there was an error submitting your feedback. Let's start over.\n\nHow would you rate your overall experience with GEM? Rate from 1 to 10.",
      error: "",
      rating: null,
      feedback: "",
      emailSent: false,
    };
  }

  return {
    step: "ASK_RATING",
    botMessage:
      "How would you rate your overall experience with GEM? Rate from 1 to 10.",
    rating: null,
    feedback: "",
    error: "",
    emailSent: false,
  };
}

function validateRating(state: FeedbackStateType): Partial<FeedbackStateType> {
  const input = (state.userInput || "").trim();
  const parsed = Number.parseInt(input, 10);

  if (Number.isNaN(parsed) || parsed < 1 || parsed > 10 || input !== String(parsed)) {
    return {
      step: "RATING_INVALID",
      error: "INVALID_RATING",
      rating: null,
    };
  }

  return {
    step: "RATING_VALID",
    rating: parsed,
    error: "",
  };
}

function askFeedback(state: FeedbackStateType): Partial<FeedbackStateType> {
  if (state.step === "FEEDBACK_INVALID") {
    return {
      step: "FEEDBACK_INVALID",
      botMessage:
        "It looks like your feedback was too short. Could you please share a bit more about your experience?",
      error: "INVALID_FEEDBACK",
    };
  }

  return {
    step: "ASK_FEEDBACK",
    botMessage: `You rated GEM a ${state.rating}/10. Could you tell us more about your experience? Please write about it in your own words.`,
    error: "",
  };
}

async function captureAndSend(
  state: FeedbackStateType
): Promise<Partial<FeedbackStateType>> {
  const feedback = (state.userInput || "").trim();

  if (!feedback || feedback.length < 10) {
    return {
      step: "FEEDBACK_INVALID",
      error: "INVALID_FEEDBACK",
      feedback: "",
    };
  }

  const payload = {
    rating: state.rating,
    feedback,
    timestamp: new Date().toISOString(),
    source: "GEM Feedback Bot",
  };

  try {
    await sendFeedbackEmail(payload);
    return {
      step: "EMAIL_SENT",
      feedback,
      emailSent: true,
      error: "",
    };
  } catch (err) {
    console.error("Email send failed:", err);
    return {
      step: "EMAIL_FAILED",
      error: "EMAIL_SEND_FAILED",
      emailSent: false,
      feedback: "",
    };
  }
}

function thankYou(state: FeedbackStateType): Partial<FeedbackStateType> {
  return {
    step: "DONE",
    botMessage:
      "Thank you so much for your feedback! Your response has been recorded. We truly appreciate you taking the time to share your experience with GEM. Have a wonderful day!",
  };
}

// ─── Build the Graph ────────────────────────────────────────────────────────

const workflow = new StateGraph(FeedbackState)
  .addNode("askRating", askRating)
  .addNode("validateRating", validateRating)
  .addNode("askFeedback", askFeedback)
  .addNode("captureAndSend", captureAndSend)
  .addNode("thankYou", thankYou)

  .addEdge(START, "askRating")

  .addConditionalEdges("askRating", routeFromAskRating, {
    validateRating: "validateRating",
    askRating: "askRating",
  })

  .addEdge("askRating", "validateRating")

  .addConditionalEdges("validateRating", routeFromValidateRating, {
    askFeedback: "askFeedback",
    askRating: "askRating",
  })

  .addConditionalEdges("askFeedback", routeFromAskFeedback, {
    captureAndSend: "captureAndSend",
    askFeedback: "askFeedback",
  })

  .addConditionalEdges("captureAndSend", routeFromCaptureAndSend, {
    thankYou: "thankYou",
    askFeedback: "askFeedback",
    askRating: "askRating",
  })

  .addEdge("thankYou", END);

const checkpointer = new MemorySaver();
export const feedbackGraph = workflow.compile({ checkpointer });

// ─── Step-based Executor ────────────────────────────────────────────────────

export async function runFeedbackStep(
  sessionId: string,
  userInput: string,
  currentStep: string
): Promise<{ botMessage: string; nextStep: string; rating: number | null; emailSent: boolean }> {

  const threadConfig = { configurable: { thread_id: sessionId } };

  if (currentStep === "INIT") {
    const result = await feedbackGraph.invoke(
      {
        step: "INIT",
        userInput: "",
        rating: null,
        feedback: "",
        botMessage: "",
        error: "",
        emailSent: false,
        retryCount: 0,
      },
      threadConfig
    );

    return {
      botMessage: result.botMessage,
      nextStep: result.step,
      rating: result.rating ?? null,
      emailSent: result.emailSent ?? false,
    };
  }

  // For subsequent steps, feed user input into the graph
  // The graph's conditional edges handle routing based on state
  const stepMap: Record<string, string> = {
    ASK_RATING: "validateRating",
    RATING_INVALID: "validateRating",
    ASK_FEEDBACK: "captureAndSend",
    FEEDBACK_INVALID: "captureAndSend",
  };

  const nextGraphStep = stepMap[currentStep] || "askRating";

  const result = await feedbackGraph.invoke(
    {
      step: currentStep,
      userInput,
      rating: null,
      feedback: "",
      botMessage: "",
      error: "",
      emailSent: false,
      retryCount: 0,
    },
    threadConfig
  );

  return {
    botMessage: result.botMessage,
    nextStep: result.step,
    rating: result.rating ?? null,
    emailSent: result.emailSent ?? false,
  };
}