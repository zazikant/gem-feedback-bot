"use client";

import { Star, RotateCcw, CheckCircle2, Bot, User, Loader2, Send, Building2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useFeedbackFlow } from "@/hooks/use-feedback-flow";

export default function WidgetPage() {
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
    <div className="flex flex-col h-screen bg-white" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Compact Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#1a1a2e] text-white">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
            <Star className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">GEM Feedback</p>
            <p className="text-[10px] text-white/60 leading-tight">Your experience matters</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {currentStep === "DONE" && (
            <button
              onClick={restartSurvey}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title="Restart"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Compact Progress */}
      <div className="flex items-center gap-1 px-4 py-2 bg-gray-50 border-b border-gray-100">
        {[
          { label: "Rate", icon: Star },
          { label: "Feedback", icon: CheckCircle2 },
          { label: "Company", icon: Building2 },
          { label: "Done", icon: CheckCircle2 },
        ].map((phase, i) => {
          const isComplete =
            (i === 0 && ["ASK_FEEDBACK", "FEEDBACK_INVALID", "ASK_COMPANY", "DONE", "THANK_YOU", "EMAIL_SENT", "EMAIL_FAILED"].includes(currentStep)) ||
            (i === 1 && ["ASK_COMPANY", "DONE", "THANK_YOU", "EMAIL_SENT", "EMAIL_FAILED"].includes(currentStep)) ||
            (i === 2 && currentStep === "DONE") ||
            (i === 3 && currentStep === "DONE");
          const isActive =
            (i === 0 && ["ASK_RATING", "RATING_INVALID"].includes(currentStep)) ||
            (i === 1 && ["ASK_FEEDBACK", "FEEDBACK_INVALID"].includes(currentStep)) ||
            (i === 2 && currentStep === "ASK_COMPANY");

          return (
            <div key={phase.label} className="flex items-center gap-1 flex-1">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  isComplete
                    ? "bg-green-500 text-white"
                    : isActive
                      ? "bg-[#1a1a2e] text-white"
                      : "bg-gray-200 text-gray-400"
                }`}
              >
                {isComplete ? "✓" : <phase.icon className="w-2.5 h-2.5" />}
              </div>
              <span className={`text-[10px] ${isComplete || isActive ? "text-gray-800" : "text-gray-400"}`}>
                {phase.label}
              </span>
              {i < 3 && <div className={`flex-1 h-px ${isComplete ? "bg-green-500" : "bg-gray-200"}`} />}
            </div>
          );
        })}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {message.role === "bot" && (
              <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-[#1a1a2e] text-white flex items-center justify-center mt-0.5">
                <Bot className="w-3 h-3" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap ${
                message.role === "user"
                  ? "bg-[#1a1a2e] text-white rounded-br-sm"
                  : "bg-gray-100 text-gray-800 rounded-bl-sm"
              }`}
            >
              {message.content}
            </div>
            {message.role === "user" && (
              <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-gray-200 text-gray-600 flex items-center justify-center mt-0.5">
                <User className="w-3 h-3" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2 justify-start">
            <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-[#1a1a2e] text-white flex items-center justify-center mt-0.5">
              <Bot className="w-3 h-3" />
            </div>
            <div className="bg-gray-100 text-gray-500 rounded-xl rounded-bl-sm px-3 py-2 text-[13px]">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Thinking...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 bg-white px-3 py-2">
        <form ref={formRef} onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex-1">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={getPlaceholder()}
              disabled={isInputDisabled}
              rows={1}
              className="resize-none min-h-[38px] max-h-[100px] text-[13px] rounded-lg border-gray-200 bg-gray-50 focus-visible:ring-[#1a1a2e]"
            />
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={(!input.trim() && !isOptionalStep) || isInputDisabled}
            className="flex-shrink-0 rounded-lg w-9 h-9 bg-[#1a1a2e] hover:bg-[#2a2a4e]"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </form>
      </div>
    </div>
  );
}