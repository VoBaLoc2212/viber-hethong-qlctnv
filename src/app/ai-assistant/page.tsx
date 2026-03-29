"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Plus, Send, Sparkles, Trash2, Upload } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuthSession } from "@/components/auth-session-provider";
import { AUTH_TOKEN_STORAGE_KEY } from "@/lib/auth/rbac";

type AiCitation = {
  source: string;
  snippet: string;
};

type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM" | "TOOL";
  content: string;
  intent: string | null;
  routeUsed: "SERVICE" | "RAG" | "TEXT2SQL" | null;
  citations: AiCitation[];
  createdAt: string;
};

type ChatSession = {
  id: string;
  title: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type KnowledgeDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: "PROCESSING" | "READY" | "FAILED" | "ARCHIVED";
  errorMessage: string | null;
  uploadedById: string;
  createdAt: string;
  updatedAt: string;
};

function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseApiError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { message?: string; code?: string };
    if (payload?.message) {
      return payload.message;
    }

    if (payload?.code) {
      return payload.code;
    }
  } catch {
    // ignore
  }

  return fallback;
}

function formatAssistantMessage(content: string) {
  return content
    .replace(/\*\*/g, "")
    .replace(/(\d+\.)\s{2,}/g, "$1 ")
    .replace(/(^|\n)-\s{2,}/g, "$1- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function AiAssistantPage() {
  const { currentUser } = useAuthSession();

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [uploading, setUploading] = useState(false);

  const isFinanceAdmin = currentUser?.role === "FINANCE_ADMIN";
  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  async function loadSessions() {
    const response = await fetch("/api/ai/sessions", {
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
    });

    if (!response.ok) {
      throw new Error(await parseApiError(response, "Không thể tải danh sách phiên chat"));
    }

    const payload = (await response.json()) as { data?: { sessions?: ChatSession[] } };
    const list = payload.data?.sessions ?? [];
    setSessions(list);

    if (!sessionId && list.length > 0) {
      setSessionId(list[0].id);
    }
  }

  async function loadMessages(id: string) {
    const response = await fetch(`/api/ai/sessions/${encodeURIComponent(id)}`, {
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
    });

    if (!response.ok) {
      throw new Error(await parseApiError(response, "Không thể tải lịch sử hội thoại"));
    }

    const payload = (await response.json()) as { data?: { messages?: ChatMessage[] } };
    setMessages(payload.data?.messages ?? []);
  }

  async function loadKnowledgeDocuments() {
    if (!isFinanceAdmin) {
      setDocuments([]);
      return;
    }

    const response = await fetch("/api/ai/knowledge/documents", {
      cache: "no-store",
      headers: {
        ...getAuthHeader(),
      },
    });

    if (!response.ok) {
      throw new Error(await parseApiError(response, "Không thể tải danh sách tài liệu tri thức"));
    }

    const payload = (await response.json()) as { data?: { documents?: KnowledgeDocument[] } };
    setDocuments(payload.data?.documents ?? []);
  }

  async function createNewSession() {
    setError(null);
    const response = await fetch("/api/ai/sessions", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error(await parseApiError(response, "Không thể tạo phiên chat mới"));
    }

    const payload = (await response.json()) as { data?: { session?: ChatSession } };
    const created = payload.data?.session;
    if (!created) {
      throw new Error("Không thể tạo phiên chat mới");
    }

    await loadSessions();
    setSessionId(created.id);
    setMessages([]);
  }

  async function deleteSession(id: string) {
    setError(null);
    const response = await fetch(`/api/ai/sessions/${encodeURIComponent(id)}`, {
      method: "DELETE",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
    });

    if (!response.ok) {
      throw new Error(await parseApiError(response, "Không thể xóa phiên chat"));
    }

    const currentSessionId = sessionId;
    const updated = sessions.filter((session) => session.id !== id);
    setSessions(updated);

    if (currentSessionId === id) {
      const nextSession = updated[0];
      if (nextSession) {
        setSessionId(nextSession.id);
      } else {
        setSessionId(null);
        setMessages([]);
      }
    }
  }

  async function uploadKnowledgeFile(file: File) {
    if (!isFinanceAdmin) return;

    setUploading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("file", file);

      const response = await fetch("/api/ai/knowledge/documents", {
        method: "POST",
        cache: "no-store",
        headers: {
          ...getAuthHeader(),
        },
        body: form,
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, "Không thể nạp tài liệu"));
      }

      await loadKnowledgeDocuments();
    } finally {
      setUploading(false);
    }
  }

  async function removeKnowledgeDocument(id: string) {
    if (!isFinanceAdmin) return;

    setError(null);
    const response = await fetch(`/api/ai/knowledge/documents/${encodeURIComponent(id)}`, {
      method: "DELETE",
      cache: "no-store",
      headers: {
        ...getAuthHeader(),
      },
    });

    if (!response.ok) {
      throw new Error(await parseApiError(response, "Không thể xóa tài liệu"));
    }

    await loadKnowledgeDocuments();
  }

  useEffect(() => {
    void loadSessions().catch((err) => setError(err instanceof Error ? err.message : "Không thể tải dữ liệu"));
    if (isFinanceAdmin) {
      void loadKnowledgeDocuments().catch((err) => setError(err instanceof Error ? err.message : "Không thể tải dữ liệu"));
    }
  }, [isFinanceAdmin]);

  useEffect(() => {
    if (!sessionId) return;
    void loadMessages(sessionId).catch((err) => setError(err instanceof Error ? err.message : "Không thể tải tin nhắn"));
  }, [sessionId]);

  async function sendMessage() {
    if (!canSend) return;
    setLoading(true);
    setError(null);

    const currentInput = input.trim();
    setInput("");

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          sessionId,
          message: currentInput,
          clientMessageId: `${Date.now()}`,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, "Gửi câu hỏi thất bại"));
      }

      const payload = (await response.json()) as {
        data?: {
          sessionId: string;
          answer: string;
          intent: string;
          routeUsed: "SERVICE" | "RAG" | "TEXT2SQL";
          citations: AiCitation[];
          suggestedActions: string[];
        };
      };

      const data = payload.data;
      if (!data) {
        throw new Error("Phản hồi AI không hợp lệ");
      }

      setSessionId(data.sessionId);
      await loadSessions();
      await loadMessages(data.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra khi gửi tin nhắn");
      setInput(currentInput);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100svh-8rem)] flex-col gap-4">
      <div className="mb-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:gap-3 sm:text-3xl">
          Trợ lý AI <Sparkles className="h-6 w-6 text-primary" />
        </h1>
        <p className="mt-1 text-muted-foreground">Hỏi về chi phí, ngân sách, cảnh báo và hướng dẫn thao tác hệ thống.</p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className={`grid flex-1 grid-cols-1 gap-4 ${isFinanceAdmin ? "xl:grid-cols-[280px_1fr_340px]" : "lg:grid-cols-[280px_1fr]"}`}>
        <Card className="border-border/50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-sm font-medium">Phiên chat</div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={() => {
                void createNewSession().catch((err) => setError(err instanceof Error ? err.message : "Không thể tạo phiên chat mới"));
              }}
              disabled={loading}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="space-y-2">
            {sessions.length === 0 ? <p className="text-xs text-muted-foreground">Chưa có phiên chat nào.</p> : null}
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`rounded-lg border p-2 text-xs ${sessionId === session.id ? "border-primary bg-primary/5" : "border-border/60"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setSessionId(session.id)}
                  >
                    <p className="line-clamp-1 font-medium">{session.title || "Phiên chat mới"}</p>
                    <p className="mt-1 text-muted-foreground">{session.lastMessageAt ? new Date(session.lastMessageAt).toLocaleString("vi-VN") : "Chưa có tin nhắn"}</p>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => {
                      void deleteSession(session.id).catch((err) => setError(err instanceof Error ? err.message : "Không thể xóa phiên chat"));
                    }}
                    disabled={loading}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="flex flex-1 flex-col overflow-hidden border-border/50 shadow-sm">
          <div className="flex-1 space-y-3 overflow-auto p-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <p className="max-w-md text-sm text-muted-foreground">Bắt đầu với câu hỏi như: “Phòng nào sắp vượt ngân sách?” hoặc “So sánh chi phí Q1 vs Q2”.</p>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`rounded-xl border p-3 text-sm ${message.role === "USER" ? "ml-8 border-primary/40 bg-primary/5" : "mr-8 border-border/60 bg-card"}`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{message.role === "ASSISTANT" ? formatAssistantMessage(message.content) : message.content}</p>
                  {message.role === "ASSISTANT" && message.routeUsed ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">Nguồn: {message.routeUsed}</p>
                  ) : null}
                  {message.role === "ASSISTANT" && message.citations.length > 0 ? (
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
                      {message.citations.map((citation, index) => (
                        <li key={`${message.id}-${index}`}>
                          {citation.source}: {citation.snippet}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border/50 bg-background p-4">
            <div className="relative">
              <Input
                placeholder="Ví dụ: Ngân sách Marketing còn bao nhiêu?"
                className="h-12 rounded-full pr-12"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                disabled={loading}
              />
              <Button
                size="icon"
                className="absolute right-1.5 top-1.5 h-9 w-9 rounded-full"
                onClick={() => void sendMessage()}
                disabled={!canSend}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">Chatbot ưu tiên dữ liệu service nội bộ, fallback RAG/Text2SQL khi cần.</p>
          </div>
        </Card>

        {isFinanceAdmin ? (
          <Card className="border-border/50 p-3">
            <div className="mb-2 text-sm font-medium">Knowledge Base (Admin)</div>
            <label className="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground hover:bg-accent/40">
              <Upload className="h-4 w-4" />
              <span>{uploading ? "Đang nạp tài liệu..." : "Nạp file .txt hoặc .docx"}</span>
              <input
                type="file"
                className="hidden"
                accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void uploadKnowledgeFile(file).catch((err) => setError(err instanceof Error ? err.message : "Không thể nạp tài liệu"));
                  event.currentTarget.value = "";
                }}
                disabled={uploading || loading}
              />
            </label>

            <div className="space-y-2">
              {documents.length === 0 ? (
                <p className="text-xs text-muted-foreground">Chưa có tài liệu tri thức nào.</p>
              ) : (
                documents.map((doc) => (
                  <div key={doc.id} className="rounded-md border p-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="line-clamp-1 font-medium">{doc.fileName}</p>
                        <p className="text-muted-foreground">{doc.status} • {Math.max(1, Math.round(doc.fileSize / 1024))} KB</p>
                        {doc.errorMessage ? <p className="text-destructive">{doc.errorMessage}</p> : null}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          void removeKnowledgeDocument(doc.id).catch((err) => setError(err instanceof Error ? err.message : "Không thể xóa tài liệu"));
                        }}
                        disabled={uploading || loading}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
