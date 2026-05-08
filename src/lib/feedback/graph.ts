/**
 * LangGraph-based Feedback Flow
 *
 * Uses LangGraph's StateGraph with a router-based pattern.
 * All nodes are reachable via the router, satisfying LangGraph's validation.
 *
 * Graph: START → router ──(conditional)──→ [askRating | validateRating | askFeedback | captureAndSend | thankYou] → END
 *
 * The router reads the current step from state and dispatches to the right node.
 * Each invocation runs: router → one node → END.
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

// ─── Router ─────────────────────────────────────────────────────────────────

function router(_state: FeedbackStateType): Partial<FeedbackStateType> {
  return {}; // Pass-through
}

function routeFromRouter(
  state: FeedbackStateType
): "askRating" | "validateRating" | "askFeedback" | "captureAndSend" | "thankYou" {
  switch (state.step) {
    case "INIT":
    case "RATING_INVALID":
    case "EMAIL_FAILED":
      return "askRating";
    case "VALIDATE_RATING":
      return "validateRating";
    case "RATING_VALID":
    case "FEEDBACK_INVALID":
      return "askFeedback";
    case "CAPTURE_FEEDBACK":
      return "captureAndSend";
    case "EMAIL_SENT":
    case "DONE":
      return "thankYou";
    default:
      return "askRating";
  }
}

// ─── Graph Nodes ────────────────────────────────────────────────────────────

function askRating(state: FeedbackStateType): Partial<FeedbackStateType> {
  if (state.step === "RATING_INVALID") {
    return {
      step: "ASK_RATING",
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
      step: "ASK_RATING",
      botMessage:
        "Sorry, there was an error submitting your feedback. Let's start over.\n\nHow would you rate your overall experience with GEM? Rate from 1 to 10.",
      error: "",
      rating: null,
      feedback: "",
      emailSent: false,
    };
  }

  // INIT or fresh start
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
      step: "ASK_FEEDBACK",
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
  .addNode("router", router)
  .addNode("askRating", askRating)
  .addNode("validateRating", validateRating)
  .addNode("askFeedback", askFeedback)
  .addNode("captureAndSend", captureAndSend)
  .addNode("thankYou", thankYou)

  .addEdge(START, "router")

  .addConditionalEdges("router", routeFromRouter, {
    askRating: "askRating",
    validateRating: "validateRating",
    askFeedback: "askFeedback",
    captureAndSend: "captureAndSend",
    thankYou: "thankYou",
  })

  .addEdge("askRating", END)
  .addEdge("validateRating", END)
  .addEdge("askFeedback", END)
  .addEdge("captureAndSend", END)
  .addEdge("thankYou", END);

const checkpointer = new MemorySaver();
export const feedbackGraph = workflow.compile({ checkpointer });

// ─── Step-based Executor ────────────────────────────────────────────────────

// In-memory state store for cross-request persistence
const stateStore = new Map<string, Partial<FeedbackStateType>>();

export async function runFeedbackStep(
  sessionId: string,
  userInput: string,
  currentStep: string
): Promise<{ botMessage: string; nextStep: string; rating: number | null; emailSent: boolean }> {

  // ─── INIT ────────────────────────────────────────────────────────────
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
      { configurable: { thread_id: sessionId } }
    );

    stateStore.set(sessionId, result);

    return {
      botMessage: result.botMessage,
      nextStep: result.step,
      rating: result.rating ?? null,
      emailSent: result.emailSent ?? false,
    };
  }

  // ─── ASK_RATING: User submitted a rating ────────────────────────────
  if (currentStep === "ASK_RATING" || currentStep === "RATING_INVALID") {
    // Run validateRating via the graph
    const result = await feedbackGraph.invoke(
      {
        step: "VALIDATE_RATING",
        userInput,
        rating: null,
        feedback: "",
        botMessage: "",
        error: "",
        emailSent: false,
        retryCount: 0,
      },
      { configurable: { thread_id: `${sessionId}-validate` } }
    );

    if (result.step === "RATING_INVALID") {
      // Re-ask with error
      const askResult = await feedbackGraph.invoke(
        {
          step: "RATING_INVALID",
          userInput: "",
          rating: null,
          feedback: "",
          botMessage: "",
          error: "INVALID_RATING",
          emailSent: false,
          retryCount: 0,
        },
        { configurable: { thread_id: `${sessionId}-reask` } }
      );

      return {
        botMessage: askResult.botMessage,
        nextStep: "ASK_RATING",
        rating: null,
        emailSent: false,
      };
    }

    // Valid — store rating and proceed to askFeedback
    stateStore.set(sessionId, { rating: result.rating });

    const feedbackResult = await feedbackGraph.invoke(
      {
        step: "RATING_VALID",
        userInput: "",
        rating: result.rating,
        feedback: "",
        botMessage: "",
        error: "",
        emailSent: false,
        retryCount: 0,
      },
      { configurable: { thread_id: `${sessionId}-askfeedback` } }
    );

    return {
      botMessage: feedbackResult.botMessage,
      nextStep: "ASK_FEEDBACK",
      rating: result.rating ?? null,
      emailSent: false,
    };
  }

  // ─── ASK_FEEDBACK: User submitted feedback ──────────────────────────
  if (currentStep === "ASK_FEEDBACK" || currentStep === "FEEDBACK_INVALID") {
    const savedState = stateStore.get(sessionId);
    const rating = savedState?.rating ?? null;

    // Run captureAndSend via the graph
    const result = await feedbackGraph.invoke(
      {
        step: "CAPTURE_FEEDBACK",
        userInput,
        rating,
        feedback: "",
        botMessage: "",
        error: "",
        emailSent: false,
        retryCount: 0,
      },
      { configurable: { thread_id: `${sessionId}-capture` } }
    );

    if (result.step === "FEEDBACK_INVALID") {
      // Re-ask feedback
      const askResult = await feedbackGraph.invoke(
        {
          step: "FEEDBACK_INVALID",
          userInput: "",
          rating,
          feedback: "",
          botMessage: "",
          error: "INVALID_FEEDBACK",
          emailSent: false,
          retryCount: 0,
        },
        { configurable: { thread_id: `${sessionId}-reask-fb` } }
      );

      return {
        botMessage: askResult.botMessage,
        nextStep: "ASK_FEEDBACK",
        rating,
        emailSent: false,
      };
    }

    if (result.step === "EMAIL_FAILED") {
      // Full restart
      const askResult = await feedbackGraph.invoke(
        {
          step: "EMAIL_FAILED",
          userInput: "",
          rating: null,
          feedback: "",
          botMessage: "",
          error: "EMAIL_SEND_FAILED",
          emailSent: false,
          retryCount: 0,
        },
        { configurable: { thread_id: `${sessionId}-restart` } }
      );

      stateStore.set(sessionId, { rating: null });

      return {
        botMessage: askResult.botMessage,
        nextStep: "ASK_RATING",
        rating: null,
        emailSent: false,
      };
    }

    // Success!
    const thanksResult = await feedbackGraph.invoke(
      {
        step: "EMAIL_SENT",
        userInput: "",
        rating,
        feedback: result.feedback,
        botMessage: "",
        error: "",
        emailSent: true,
        retryCount: 0,
      },
      { configurable: { thread_id: `${sessionId}-thanks` } }
    );

    return {
      botMessage: thanksResult.botMessage,
      nextStep: "DONE",
      rating,
      emailSent: true,
    };
  }

  // ─── DONE ────────────────────────────────────────────────────────────
  return {
    botMessage: "Your feedback has already been submitted. Thank you! Refresh the page to start a new survey.",
    nextStep: "DONE",
    rating: null,
    emailSent: true,
  };
}
