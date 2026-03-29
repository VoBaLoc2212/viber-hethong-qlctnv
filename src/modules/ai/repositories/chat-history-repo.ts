import { prisma } from "@/lib/db/prisma/client";
import { AppError } from "@/modules/shared/errors/app-error";

import type { AiCitation, AiMessage, AiRouteUsed, AiSessionSummary } from "../types";

export type ChatContextMessage = {
  role: "USER" | "ASSISTANT" | "SYSTEM" | "TOOL";
  content: string;
};

type ChatDb = {
  chatSession?: {
    findFirst: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any[]>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
  chatMessage?: {
    findMany: (args: any) => Promise<any[]>;
    create: (args: any) => Promise<any>;
  };
};

function delegates() {
  const db = prisma as unknown as ChatDb;

  if (!db.chatSession || !db.chatMessage) {
    throw new AppError(
      "Chat history models are unavailable. Run Prisma migration and generate client.",
      "INTERNAL_SERVER_ERROR",
    );
  }

  return {
    chatSession: db.chatSession,
    chatMessage: db.chatMessage,
  };
}

function normalizeCitations(input: unknown): AiCitation[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      if (typeof value.source !== "string" || typeof value.snippet !== "string") {
        return null;
      }

      return { source: value.source, snippet: value.snippet };
    })
    .filter((item): item is AiCitation => Boolean(item));
}

function mapSessionSummary(row: {
  id: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date | null;
}): AiSessionSummary {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
  };
}

export async function createChatSession(userId: string, titleHint?: string): Promise<AiSessionSummary> {
  const db = delegates();

  const title = titleHint?.trim() ? titleHint.trim().slice(0, 120) : null;
  const created = await db.chatSession.create({
    data: {
      userId,
      title,
      archived: false,
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      lastMessageAt: true,
    },
  });

  return mapSessionSummary(created);
}

export async function ensureChatSession(userId: string, sessionId: string | undefined, titleHint: string) {
  const db = delegates();

  if (sessionId) {
    const existing = await db.chatSession.findFirst({
      where: { id: sessionId, userId, archived: false },
      select: { id: true },
    });

    if (existing) {
      return existing.id as string;
    }
  }

  const created = await db.chatSession.create({
    data: {
      userId,
      title: titleHint.slice(0, 120),
      lastMessageAt: new Date(),
      archived: false,
    },
    select: { id: true },
  });

  return created.id as string;
}

export async function appendChatMessage(input: {
  sessionId: string;
  role: "USER" | "ASSISTANT" | "SYSTEM" | "TOOL";
  content: string;
  intent?: string | null;
  routeUsed?: AiRouteUsed | null;
  citations?: AiCitation[];
  relatedData?: Record<string, unknown>;
  suggestedActions?: string[];
  correlationId?: string;
  latencyMs?: number;
}) {
  const db = delegates();

  await db.chatMessage.create({
    data: {
      sessionId: input.sessionId,
      role: input.role,
      content: input.content,
      intent: input.intent ?? null,
      routeUsed: input.routeUsed ?? null,
      citations: input.citations ?? null,
      relatedData: input.relatedData ?? null,
      suggestedActions: input.suggestedActions ?? null,
      correlationId: input.correlationId ?? null,
      latencyMs: input.latencyMs ?? null,
    },
  });

  await db.chatSession.update({
    where: { id: input.sessionId },
    data: { lastMessageAt: new Date() },
  });
}

export async function listChatSessions(userId: string): Promise<AiSessionSummary[]> {
  const db = delegates();

  const rows = await db.chatSession.findMany({
    where: { userId, archived: false },
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    take: 30,
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      lastMessageAt: true,
    },
  });

  return rows.map(mapSessionSummary);
}

export async function archiveChatSession(userId: string, sessionId: string): Promise<{ id: string; archived: true }> {
  const db = delegates();

  const existing = await db.chatSession.findFirst({
    where: { id: sessionId, userId, archived: false },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError("Chat session not found", "NOT_FOUND");
  }

  await db.chatSession.update({
    where: { id: sessionId },
    data: { archived: true },
  });

  return { id: sessionId, archived: true };
}

export async function listRecentChatContext(
  userId: string,
  sessionId: string,
  limit = 8,
): Promise<ChatContextMessage[]> {
  const db = delegates();

  const session = await db.chatSession.findFirst({
    where: { id: sessionId, userId, archived: false },
    select: { id: true },
  });

  if (!session) {
    return [];
  }

  const rows = await db.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    select: {
      role: true,
      content: true,
    },
    take: Math.max(1, Math.min(limit, 20)),
  });

  return rows
    .reverse()
    .map((row) => ({
      role: row.role,
      content: row.content,
    }));
}

export async function listChatMessages(userId: string, sessionId: string): Promise<AiMessage[]> {
  const db = delegates();

  const session = await db.chatSession.findFirst({
    where: { id: sessionId, userId, archived: false },
    select: { id: true },
  });

  if (!session) {
    throw new AppError("Chat session not found", "NOT_FOUND");
  }

  const rows = await db.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      content: true,
      intent: true,
      routeUsed: true,
      citations: true,
      createdAt: true,
    },
    take: 300,
  });

  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    intent: row.intent ?? null,
    routeUsed: row.routeUsed ?? null,
    citations: normalizeCitations(row.citations),
    createdAt: row.createdAt.toISOString(),
  }));
}
