"use client";

import { Sparkles, Send, Bot } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AiAssistantPage() {
  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          AI Assistant <Sparkles className="w-6 h-6 text-primary" />
        </h1>
        <p className="text-muted-foreground mt-1">Ask questions about your finances, generate insights, or find anomalies.</p>
      </div>

      <Card className="flex-1 flex flex-col border-border/50 shadow-sm overflow-hidden bg-gradient-to-b from-card to-secondary/20">
        <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 relative">
            <Bot className="w-10 h-10 text-primary" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">I'm currently being trained!</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-8 text-sm leading-relaxed">
            The intelligent financial assistant is arriving soon. Soon you'll be able to ask things like "Why are my marketing expenses higher this month?" or "Can we afford to hire two new engineers in Q3?"
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl text-left">
            <div className="bg-background border border-border/50 p-4 rounded-xl shadow-sm opacity-60">
              <p className="text-sm font-medium">"Summarize my travel expenses for Q1"</p>
            </div>
            <div className="bg-background border border-border/50 p-4 rounded-xl shadow-sm opacity-60">
              <p className="text-sm font-medium">"Are there any duplicate transactions?"</p>
            </div>
            <div className="bg-background border border-border/50 p-4 rounded-xl shadow-sm opacity-60">
              <p className="text-sm font-medium">"Generate a budget forecast for 2025"</p>
            </div>
            <div className="bg-background border border-border/50 p-4 rounded-xl shadow-sm opacity-60">
              <p className="text-sm font-medium">"Which department is over budget?"</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-background border-t border-border/50">
          <div className="relative max-w-4xl mx-auto">
            <Input placeholder="Ask anything..." className="pr-12 h-12 rounded-full border-border/60 shadow-sm bg-card" disabled />
            <Button size="icon" className="absolute right-1.5 top-1.5 h-9 w-9 rounded-full" disabled>
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-center text-muted-foreground mt-3">AI features are currently in beta testing.</p>
        </div>
      </Card>
    </div>
  );
}
