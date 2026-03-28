"use client";

export const dynamic = "force-dynamic";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Bot, Loader2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AUTH_TOKEN_STORAGE_KEY } from "@/lib/auth/rbac";
import type { AIResponse, ChatRequest } from "@/modules/ai/types";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  response?: AIResponse;
}

export default function AiAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Get token safely
  const getToken = () => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "";
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || loading) return;

    const currentInput = input;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: currentInput,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const request: ChatRequest = {
        question: currentInput,
        conversation_id: conversationId,
      };

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        let errorMessage = "Failed to get AI response";

        try {
          const errData = await response.json();
          errorMessage = errData?.message || errorMessage;
        } catch {}

        throw new Error(errorMessage);
      }

      const data: { data: AIResponse } = await response.json();
      const aiResponse = data.data;

      // set conversationId nếu chưa có
      if (!conversationId && aiResponse.conversation_id) {
        setConversationId(aiResponse.conversation_id);
      }

      const assistantMessage: Message = {
        id: aiResponse.id,
        role: "assistant",
        content: aiResponse.answer,
        timestamp: new Date(),
        response: aiResponse,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      console.error("AI Chat Error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100svh-8rem)] flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:gap-3 sm:text-3xl">
          AI Assistant <Sparkles className="w-6 h-6 text-primary" />
        </h1>
        <p className="text-muted-foreground mt-1">
          Ask questions about your finances, generate insights, or find anomalies.
        </p>
      </div>

      {/* Chat Box */}
      <Card className="flex-1 flex flex-col border-border/50 shadow-sm overflow-hidden bg-gradient-to-b from-card to-secondary/20">
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {messages.length === 0 ? (
            <EmptyState setInput={setInput} />
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className="flex gap-4 animate-in fade-in slide-in-from-bottom-2"
              >
                {msg.role === "user" ? (
                  <div className="flex-1 ml-auto max-w-2xl">
                    <div className="bg-primary text-primary-foreground rounded-lg px-4 py-3">
                      <p className="text-sm">{msg.content}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 ml-2">
                      {msg.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                      <Bot className="w-5 h-5 text-primary" />
                    </div>

                    <div className="flex-1 max-w-2xl">
                      <div className="bg-secondary rounded-lg px-4 py-3">
                        <p className="text-sm whitespace-pre-wrap">
                          {msg.content}
                        </p>

                        {/* Citations */}
                        {msg.response?.citations?.length ? (
                          <div className="mt-4 pt-3 border-t border-border/20">
                            <p className="text-xs font-semibold text-muted-foreground mb-2">
                              Sources:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {msg.response.citations.map((c) => (
                                <span
                                  key={c.reference?.id ?? c.source}
                                  className="text-xs bg-background/50 px-2 py-1 rounded border"
                                >
                                  {c.source}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {/* Follow ups */}
                        {msg.response?.suggested_follow_ups?.length ? (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground">
                              Follow-up:
                            </p>
                            {msg.response.suggested_follow_ups
                              .slice(0, 2)
                              .map((f, i) => (
                                <button
                                  key={i}
                                  onClick={() => setInput(f)}
                                  className="text-xs text-primary hover:underline block text-left"
                                >
                                  → {f}
                                </button>
                              ))}
                          </div>
                        ) : null}
                      </div>

                      <p className="text-xs text-muted-foreground mt-1 ml-2">
                        {msg.timestamp.toLocaleTimeString()} •{" "}
                        {msg.response?.process_metadata?.time_ms ?? "-"}ms
                      </p>
                    </div>
                  </>
                )}
              </div>
            ))
          )}

          {/* Loading */}
          {loading && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
              <div className="bg-secondary rounded-lg px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Analyzing your data...
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto">
            <div className="relative">
              <Input
                placeholder="Ask anything about your finances..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                className="pr-12 h-12 rounded-full"
              />

              <Button
                type="submit"
                size="icon"
                disabled={loading || !input.trim()}
                className="absolute right-1.5 top-1.5 h-9 w-9 rounded-full"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-[10px] text-center text-muted-foreground mt-3">
              AI features are in beta. Never share sensitive information.
            </p>
          </form>
        </div>
      </Card>
    </div>
  );
}

/* ================= EMPTY STATE ================= */
function EmptyState({ setInput }: { setInput: (v: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 relative">
        <Bot className="w-10 h-10 text-primary" />
      </div>

      <h2 className="text-2xl font-semibold mb-2">
        AI-powered Financial Insights
      </h2>

      <p className="text-muted-foreground max-w-md mb-8 text-sm">
        Ask about budget, expenses, or anomalies in your financial data.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 w-full max-w-xl">
        {[
          "Tóm tắt chi phí tháng này",
          "Có bất thường nào không?",
          "Ngân sách nào sắp hết?",
          "So sánh chi phí q1 vs q2",
        ].map((text) => (
          <button
            key={text}
            onClick={() => setInput(text)}
            className="border p-4 rounded-xl hover:bg-accent text-left"
          >
            <p className="text-sm font-medium">"{text}"</p>
          </button>
        ))}
      </div>
    </div>
  );
}