/**
 * LangGraph-based Feedback Flow
 *
 * Uses LangGraph's StateGraph with proper conditional edges.
 * The graph is self-contained: each node transitions to the next
 * based on state, with no external executor loop required.
 *
 * Flow: START → askRating ──(conditional)──→ [validateRating | askRating (re-ask)]
 *        validateRating ──(conditional)──→ [askFeedback | askRating (invalid)]
 *        askFeedback ──(conditional)──→ [askCompany | askFeedback (re-ask)]
 *        askCompany ──(always)──→ captureAndSend
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
  company: Annotation<string>,
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
  return "askingFeedback";
}

function routeFromAskFeedback(state: FeedbackStateType): "askCompany" | "askFeedback" {
  if (state.step === "FEEDBACK_INVALID") {
    return "askFeedback";
  }
  return "askCompany";
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
      company: "",
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
      company: "",
      emailSent: false,
    };
  }

  return {
    step: "ASK_RATING",
    botMessage:
      "How would you rate your overall experience with GEM? Rate from 1 to 10.",
    rating: null,
    feedback: "",
    company: "",
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

function askCompany(state: FeedbackStateType): Partial<FeedbackStateType> {
  return {
    step: "ASK_COMPANY",
    botMessage: "Would you like to share your company name? This is optional — you can press Enter to skip.",
    error: "",
  };
}

async function captureAndSend(
  state: FeedbackStateType
): Promise<Partial<FeedbackStateType>> {
  const feedback = (state.userInput || "").trim();

  // This node runs twice: once after askFeedback (capturing feedback text),
  // once after askCompany (capturing company name). We need to determine context.
  // When called from askCompany path, the feedback is already in state.
  // When called from askFeedback path, we capture the feedback text.

  if (!state.feedback && (!feedback || feedback.length < 10)) {
    return {
      step: "FEEDBACK_INVALID",
      error: "INVALID_FEEDBACK",
      feedback: "",
    };
  }

  const finalFeedback = state.feedback || feedback;
  const company = state.company || "";

  const payload = {
    rating: state.rating,
    feedback: finalFeedback,
    company: company || "Not provided",
    timestamp: new Date().toISOString(),
    source: "GEM Feedback Bot",
  };

  try {
    await sendFeedbackEmail(payload);
    return {
      step: "EMAIL_SENT",
      feedback: finalFeedback,
      company,
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
  const companyMessage = state.company
    ? `\n\nCompany: ${state.company}`
    : "";
  return {
    step: "DONE",
    botMessage:
      `Thank you so much for your feedback! Your response has been recorded. We truly appreciate you taking the time to share your experience with GEM.${companyMessage} Have a wonderful day!`,
  };
}

// ─── Build the Graph ────────────────────────────────────────────────────────

const workflow = new StateGraph(FeedbackState)
  .addNode("askRating", askRating)
  .addNode("validateRating", validateRating)
  .addNode("askFeedback", askFeedback)
  .addNode("askCompany", askCompany)
  .addNode("captureAndSend", captureAndSend)
  .addNode("thankYou", thankYou)

  .addEdge(START, "askRating")

  .addConditionalEdges("askRating", routeFromAskRating, {
    validateRating: "validateRating",
    askRating: "askRating",
  })

  .addEdge("askRating", "validateRating")

  .addConditionalEdges("validateRating", routeFromValidateRating, {
    askingFeedback: "askFeedback",
    askRating: "askRating",
  })

  .addConditionalEdges("askFeedback", routeFromAskFeedback, {
    askCompany: "askCompany",
    askFeedback: "askFeedback",
  })

  .addEdge("askCompany", "captureAndSend")

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
): Promise<{ botMessage: string; nextStep: string; rating: number | null; emailSent: boolean; company: string }> {

  const threadConfig = { configurable: { thread_id: sessionId } };

  if (currentStep === "INIT") {
    const result = await feedbackGraph.invoke(
      {
        step: "INIT",
        userInput: "",
        rating: null,
        feedback: "",
        company: "",
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
      company: result.company ?? "",
    };
  }

  if (currentStep === "ASK_COMPANY") {
    const company = userInput.trim();

    const result = await feedbackGraph.invoke(
      {
        step: "ASK_COMPANY",
        userInput: company,
        rating: null,
        feedback: "",
        company: company,
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
      company: company,
    };
  }

  const stepMap: Record<string, string> = {
    ASK_RATING: "validateRating",
    RATING_INVALID: "validateRating",
    ASK_FEEDBACK: "captureAndSend",
    FEEDBACK_INVALID: "captureAndSend",
  };

  const graphStep = stepMap[currentStep] || "askRating";

  const result = await feedbackGraph.invoke(
    {
      step: currentStep,
      userInput,
      rating: null,
      feedback: "",
      company: "",
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
    company: result.company ?? "",
  };
}