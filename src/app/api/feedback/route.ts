import { NextRequest, NextResponse } from "next/server";
import { runFeedbackStep } from "@/lib/feedback/graph";

/**
 * Feedback Chat API — LangGraph-powered
 *
 * Flow:
 *   ASK_RATING → VALIDATE ──(valid)──→ ASK_FEEDBACK → CAPTURE_AND_SEND ──(success)──→ THANK_YOU
 *                    │                                         │
 *               (invalid)                                 (error)
 *                    │                                         │
 *                    └──→ ASK_RATING (loop)        ←──────────┘
 *
 * Client sends: { sessionId, userInput, currentStep }
 * Server returns: { botMessage, nextStep, rating, emailSent, company }
 */

export async function POST(req: NextRequest) {
  try {
    const { sessionId, userInput, currentStep } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    const result = await runFeedbackStep(sessionId, userInput || "", currentStep || "INIT");

    return NextResponse.json(result);
  } catch (error) {
    console.error("Feedback API error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        botMessage: "Something went wrong. Please try again.",
        nextStep: "ASK_RATING",
        rating: null,
        emailSent: false,
        company: "",
      },
      { status: 500 }
    );
  }
}
