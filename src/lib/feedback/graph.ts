/**
 * LangGraph-based Feedback Flow
 *
 * Step-based state machine: each invocation runs one node, returns to the
 * executor (runFeedbackStep), which decides the next step based on state.
 *
 * Flow:
 *   INIT → askRating → validateRating ─(valid)→ askFeedback → askCompany → captureAndSend → thankYou → END
 *                                    ─(invalid)→ askRating (loop)               ─(invalid)→ askFeedback (loop)
 *                                                                              ─(email fail)→ askRating (restart)
 *
 * Company name step is optional — user can press Enter to skip.
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

// ─── Router ─────────────────────────────────────────────────────────────────

function router(_state: FeedbackStateType): Partial<FeedbackStateType> {
  return {};
}

function routeFromRouter(
  state: FeedbackStateType
): "askRating" | "validateRating" | "askFeedback" | "askCompany" | "captureAndSend" | "thankYou" {
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
    case "ASK_COMPANY":
      return "askCompany";
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
      company: "",
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

  if (!feedback || feedback.length < 10) {
    if (!state.feedback || state.feedback.length < 10) {
      return {
        step: "FEEDBACK_INVALID",
        error: "INVALID_FEEDBACK",
        feedback: "",
      };
    }
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
  .addNode("router", router)
  .addNode("askRating", askRating)
  .addNode("validateRating", validateRating)
  .addNode("askFeedback", askFeedback)
  .addNode("askCompany", askCompany)
  .addNode("captureAndSend", captureAndSend)
  .addNode("thankYou", thankYou)

  .addEdge(START, "router")

  .addConditionalEdges("router", routeFromRouter, {
    askRating: "askRating",
    validateRating: "validateRating",
    askFeedback: "askFeedback",
    askCompany: "askCompany",
    captureAndSend: "captureAndSend",
    thankYou: "thankYou",
  })

  .addEdge("askRating", END)
  .addEdge("validateRating", END)
  .addEdge("askFeedback", END)
  .addEdge("askCompany", END)
  .addEdge("captureAndSend", END)
  .addEdge("thankYou", END);

const checkpointer = new MemorySaver();
export const feedbackGraph = workflow.compile({ checkpointer });

// ─── Step-based Executor ────────────────────────────────────────────────────

export async function runFeedbackStep(
  sessionId: string,
  userInput: string,
  currentStep: string
): Promise<{ botMessage: string; nextStep: string; rating: number | null; emailSent: boolean; company: string }> {

  const threadId = sessionId;

  // ─── INIT ────────────────────────────────────────────────────────────
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
      { configurable: { thread_id: threadId } }
    );

    return {
      botMessage: result.botMessage,
      nextStep: result.step,
      rating: result.rating ?? null,
      emailSent: result.emailSent ?? false,
      company: result.company ?? "",
    };
  }

  // ─── ASK_RATING: User submitted a rating ─────────────────────────────
  if (currentStep === "ASK_RATING" || currentStep === "RATING_INVALID") {
    const result = await feedbackGraph.invoke(
      {
        step: "VALIDATE_RATING",
        userInput,
        rating: null,
        feedback: "",
        company: "",
        botMessage: "",
        error: "",
        emailSent: false,
        retryCount: 0,
      },
      { configurable: { thread_id: threadId } }
    );

    if (result.step === "RATING_INVALID") {
      const askResult = await feedbackGraph.invoke(
        {
          step: "RATING_INVALID",
          userInput: "",
          rating: null,
          feedback: "",
          company: "",
          botMessage: "",
          error: "INVALID_RATING",
          emailSent: false,
          retryCount: 0,
        },
        { configurable: { thread_id: threadId } }
      );

      return {
        botMessage: askResult.botMessage,
        nextStep: "ASK_RATING",
        rating: null,
        emailSent: false,
        company: "",
      };
    }

    // Valid — ask for feedback
    const feedbackResult = await feedbackGraph.invoke(
      {
        step: "RATING_VALID",
        userInput: "",
        rating: result.rating,
        feedback: "",
        company: "",
        botMessage: "",
        error: "",
        emailSent: false,
        retryCount: 0,
      },
      { configurable: { thread_id: threadId } }
    );

    return {
      botMessage: feedbackResult.botMessage,
      nextStep: "ASK_FEEDBACK",
      rating: result.rating ?? null,
      emailSent: false,
      company: "",
    };
  }

  // ─── ASK_FEEDBACK: User submitted feedback text ──────────────────────
  if (currentStep === "ASK_FEEDBACK" || currentStep === "FEEDBACK_INVALID") {
    const trimmed = userInput.trim();

    if (trimmed.length < 10) {
      const askResult = await feedbackGraph.invoke(
        {
          step: "FEEDBACK_INVALID",
          userInput: "",
          rating: null,
          feedback: "",
          company: "",
          botMessage: "",
          error: "INVALID_FEEDBACK",
          emailSent: false,
          retryCount: 0,
        },
        { configurable: { thread_id: threadId } }
      );

      return {
        botMessage: askResult.botMessage,
        nextStep: "ASK_FEEDBACK",
        rating: null,
        emailSent: false,
        company: "",
      };
    }

    // Valid feedback — move to ask company
    const companyResult = await feedbackGraph.invoke(
      {
        step: "ASK_COMPANY",
        userInput: "",
        rating: null,
        feedback: trimmed,
        company: "",
        botMessage: "",
        error: "",
        emailSent: false,
        retryCount: 0,
      },
      { configurable: { thread_id: threadId } }
    );

    return {
      botMessage: companyResult.botMessage,
      nextStep: "ASK_COMPANY",
      rating: null,
      emailSent: false,
      company: "",
    };
  }

  // ─── ASK_COMPANY: User submitted company name (or skipped) ───────────
  if (currentStep === "ASK_COMPANY") {
    const companyName = userInput.trim();

    // Send the email with feedback stored from previous step
    const result = await feedbackGraph.invoke(
      {
        step: "CAPTURE_FEEDBACK",
        userInput: companyName,
        rating: null,
        feedback: "",
        company: companyName,
        botMessage: "",
        error: "",
        emailSent: false,
        retryCount: 0,
      },
      { configurable: { thread_id: threadId } }
    );

    if (result.step === "EMAIL_FAILED") {
      const askResult = await feedbackGraph.invoke(
        {
          step: "EMAIL_FAILED",
          userInput: "",
          rating: null,
          feedback: "",
          company: "",
          botMessage: "",
          error: "EMAIL_SEND_FAILED",
          emailSent: false,
          retryCount: 0,
        },
        { configurable: { thread_id: threadId } }
      );

      return {
        botMessage: askResult.botMessage,
        nextStep: "ASK_RATING",
        rating: null,
        emailSent: false,
        company: "",
      };
    }

    const thanksResult = await feedbackGraph.invoke(
      {
        step: "EMAIL_SENT",
        userInput: "",
        rating: null,
        feedback: result.feedback || "",
        company: companyName,
        botMessage: "",
        error: "",
        emailSent: true,
        retryCount: 0,
      },
      { configurable: { thread_id: threadId } }
    );

    return {
      botMessage: thanksResult.botMessage,
      nextStep: "DONE",
      rating: null,
      emailSent: true,
      company: companyName,
    };
  }

  // ─── DONE ────────────────────────────────────────────────────────────
  return {
    botMessage: "Your feedback has already been submitted. Thank you! Refresh the page to start a new survey.",
    nextStep: "DONE",
    rating: null,
    emailSent: true,
    company: "",
  };
}