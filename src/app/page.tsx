"use client";

import { Star, RotateCcw, CheckCircle2, Bot, User, Loader2, Send, MessageSquareHeart, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useFeedbackFlow } from "@/hooks/use-feedback-flow";

export default function Home() {
  const {
    messages,
    input,
    setInput,
    isLoading,
    currentStep,
    scrollRef,
    textareaRef,
    formRef,
    handleSubmit,
    handleKeyDown,
    restartSurvey,
    getPlaceholder,
    isInputDisabled,
    isOptionalStep,
  } = useFeedbackFlow();

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground">
            <Star className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              GEM Feedback
            </h1>
            <p className="text-xs text-muted-foreground">
              Your experience matters to us
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={restartSurvey}
          className="text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          Restart
        </Button>
      </header>

      {/* Progress Indicator */}
      <div className="px-4 sm:px-6 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-2 max-w-3xl mx-auto">
          {[
            { label: "Rating", step: "ASK_RATING", icon: Star },
            { label: "Feedback", step: "ASK_FEEDBACK", icon: MessageSquareHeart },
            { label: "Company", step: "ASK_COMPANY", icon: Building2 },
            { label: "Done", step: "DONE", icon: CheckCircle2 },
          ].map((phase, i) => {
            const stepOrder = ["ASK_RATING", "RATING_INVALID", "ASK_FEEDBACK", "FEEDBACK_INVALID", "ASK_COMPANY", "DONE", "THANK_YOU", "EMAIL_SENT", "EMAIL_FAILED"];
            const currentIdx = stepOrder.indexOf(currentStep);
            const isActive =
              phase.step === "ASK_RATING"
                ? currentIdx <= 1
                : phase.step === "ASK_FEEDBACK"
                  ? currentIdx >= 2 && currentIdx <= 3
                  : phase.step === "ASK_COMPANY"
                    ? currentIdx === 4
                    : currentIdx >= 5;
            const isComplete =
              phase.step === "ASK_RATING"
                ? currentIdx >= 2
                : phase.step === "ASK_FEEDBACK"
                  ? currentIdx >= 4
                  : phase.step === "ASK_COMPANY"
                    ? currentIdx >= 5
                    : false;

            return (
              <div key={phase.label} className="flex items-center gap-2 flex-1">
                <div
                  className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-colors ${
                    isComplete
                      ? "bg-green-500 text-white"
                      : isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <phase.icon className="w-3.5 h-3.5" />
                  )}
                </div>
                <span
                  className={`text-xs font-medium hidden sm:inline ${
                    isActive || isComplete
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {phase.label}
                </span>
                {i < 3 && (
                  <div
                    className={`flex-1 h-px ${
                      isComplete ? "bg-green-500" : "bg-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {message.role === "bot" && (
              <div className="flex-shrink-0 flex items-start pt-1">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
                  <Bot className="w-4 h-4" />
                </div>
              </div>
            )}
            <div
              className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted text-foreground rounded-bl-md"
              }`}
            >
              {message.content}
            </div>
            {message.role === "user" && (
              <div className="flex-shrink-0 flex items-start pt-1">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary text-secondary-foreground">
                  <User className="w-4 h-4" />
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 flex items-start pt-1">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
                <Bot className="w-4 h-4" />
              </div>
            </div>
            <div className="bg-muted text-foreground rounded-2xl rounded-bl-md px-4 py-3 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                Processing...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-card px-4 sm:px-6 py-4">
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="flex items-end gap-3 max-w-3xl mx-auto"
        >
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={getPlaceholder()}
              disabled={isInputDisabled}
              rows={1}
              className="resize-none min-h-[44px] max-h-[160px] pr-3 py-3 text-sm rounded-xl bg-background border-border focus-visible:ring-ring"
            />
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={(!input.trim() && !isOptionalStep) || isInputDisabled}
            className="flex-shrink-0 rounded-xl w-11 h-11"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
        <p className="text-xs text-center text-muted-foreground mt-2">
          {currentStep === "DONE"
            ? "Survey complete — thank you!"
            : isOptionalStep
              ? "Press Enter to skip, or type your company name"
              : "Press Enter to send, Shift+Enter for a new line"}
        </p>
      </div>
    </div>
  );
}