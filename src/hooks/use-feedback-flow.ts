import { useState, useRef, useEffect, useCallback, FormEvent } from "react";

export type FlowStep =
  | "INIT"
  | "ASK_RATING"
  | "RATING_INVALID"
  | "ASK_FEEDBACK"
  | "FEEDBACK_INVALID"
  | "ASK_COMPANY"
  | "EMAIL_SENT"
  | "EMAIL_FAILED"
  | "THANK_YOU"
  | "DONE";

export interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
}

export interface UseFeedbackFlowOptions {
  apiUrl?: string;
}

export interface UseFeedbackFlowReturn {
  messages: Message[];
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  currentStep: FlowStep;
  rating: number | null;
  emailSent: boolean;
  company: string;
  formRef: React.RefObject<HTMLFormElement | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  handleSubmit: (e?: FormEvent) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  restartSurvey: () => void;
  addMessage: (role: "user" | "bot", content: string) => void;
  getPlaceholder: () => string;
  isInputDisabled: boolean;
  isOptionalStep: boolean;
}

export function useFeedbackFlow({ apiUrl = "/api/feedback" }: UseFeedbackFlowOptions = {}): UseFeedbackFlowReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<FlowStep>("INIT");
  const [sessionId] = useState(() => crypto.randomUUID());
  const [rating, setRating] = useState<number | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [company, setCompany] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const initializedRef = useRef(false);

  const addMessage = useCallback((role: "user" | "bot", content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role, content },
    ]);
  }, []);

  const startConversation = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, userInput: "", currentStep: "INIT" }),
      });
      const data = await res.json();
      if (data.botMessage) addMessage("bot", data.botMessage);
      setCurrentStep(data.nextStep || "ASK_RATING");
      setRating(data.rating ?? null);
      setEmailSent(data.emailSent ?? false);
      setCompany(data.company ?? "");
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, sessionId, addMessage]);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      startConversation();
    }
  }, [startConversation]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleSubmit = useCallback(async (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    const isOptionalStep = currentStep === "ASK_COMPANY";
    if ((!trimmed && !isOptionalStep) || isLoading) return;

    addMessage("user", trimmed);
    setInput("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    setIsLoading(true);

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, userInput: trimmed, currentStep }),
      });
      const data = await res.json();

      if (data.botMessage) addMessage("bot", data.botMessage);
      setCurrentStep(data.nextStep || currentStep);
      setRating(data.rating ?? rating);
      setEmailSent(data.emailSent ?? false);
      setCompany(data.company ?? company);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, sessionId, input, isLoading, currentStep, rating, addMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const restartSurvey = useCallback(() => {
    setMessages([]);
    setInput("");
    setCurrentStep("INIT");
    setRating(null);
    setEmailSent(false);
    setCompany("");
  }, [startConversation]);

  const getPlaceholder = useCallback(() => {
    if (isLoading) return "Please wait...";
    switch (currentStep) {
      case "ASK_RATING":
      case "RATING_INVALID":
        return "Enter a number from 1 to 10";
      case "ASK_FEEDBACK":
      case "FEEDBACK_INVALID":
        return "Tell us about your experience...";
      case "ASK_COMPANY":
        return "Your company name (optional — press Enter to skip)";
      case "DONE":
        return "Survey complete. Refresh to restart.";
      default:
        return "Type your response...";
    }
  }, [isLoading, currentStep]);

  const isInputDisabled = isLoading || currentStep === "DONE";

  return {
    messages,
    input,
    setInput,
    isLoading,
    currentStep,
    rating,
    emailSent,
    company,
    formRef,
    scrollRef,
    textareaRef,
    handleSubmit,
    handleKeyDown,
    restartSurvey,
    addMessage,
    getPlaceholder,
    isInputDisabled,
    isOptionalStep: currentStep === "ASK_COMPANY",
  };
}