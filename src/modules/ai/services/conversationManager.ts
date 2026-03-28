/**
 * Conversation Manager Service
 * Manages conversation history, persistence, and multi-turn context
 */

import { prisma } from "@/lib/db/prisma/client";
import type { Conversation, Message } from "@/modules/ai/types";

// Cast prisma to any to bypass type generation delays
const db = prisma as any;

export class ConversationManager {
  /**
   * Create new conversation
   */
  async createConversation(
    userId: string,
    title?: string
  ): Promise<Conversation> {
    const conversation = await db.aIConversation.create({
      data: {
        userId,
        title,
      },
    });

    return {
      id: conversation.id,
      user_id: conversation.userId,
      title: conversation.title || undefined,
      metadata: conversation.metadata || undefined,
      created_at: conversation.createdAt,
      updated_at: conversation.updatedAt,
    };
  }

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId: string): Promise<Conversation | null> {
    const conversation = await db.aIConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) return null;

    return {
      id: conversation.id,
      user_id: conversation.userId,
      title: conversation.title || undefined,
      metadata: conversation.metadata || undefined,
      created_at: conversation.createdAt,
      updated_at: conversation.updatedAt,
    };
  }

  /**
   * Get user's conversations
   */
  async getUserConversations(
    userId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<Conversation[]> {
    const conversations = await db.aIConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
    });

    return conversations.map((c: any) => ({
      id: c.id,
      userId: c.userId,
      title: c.title || undefined,
      metadata: c.metadata || undefined,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  /**
   * Update conversation title
   */
  async updateConversationTitle(
    conversationId: string,
    title: string
  ): Promise<void> {
    await db.aIConversation.update({
      where: { id: conversationId },
      data: { title },
    });
  }

  /**
   * Delete conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    // Delete all messages in conversation first
    await db.aIMessage.deleteMany({
      where: { conversationId },
    });

    // Delete conversation
    await db.aIConversation.delete({
      where: { id: conversationId },
    });
  }

  /**
   * Get conversation messages
   */
  async getMessages(conversationId: string): Promise<Message[]> {
    const messages = await db.aIMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });

    return messages.map((m: any) => ({
      id: m.id,
      conversationId: m.conversationId,
      role: (m.role as "user" | "assistant"),
      question: m.question || undefined,
      answer: m.answer || undefined,
      tableData: m.tableData || undefined,
      citations: m.citations || undefined,
      processingTimeMs: m.processingTimeMs || undefined,
      tokensUsed: m.tokensUsed || undefined,
      createdAt: m.createdAt,
    }));
  }

  /**
   * Get last N messages for context
   */
  async getRecentMessages(
    conversationId: string,
    limit: number = 5
  ): Promise<Message[]> {
    const messages = await db.aIMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return messages.reverse().map((m: any) => ({
      id: m.id,
      conversationId: m.conversationId,
      role: (m.role as "user" | "assistant"),
      question: m.question || undefined,
      answer: m.answer || undefined,
      tableData: m.tableData || undefined,
      citations: m.citations || undefined,
      processingTimeMs: m.processingTimeMs || undefined,
      tokensUsed: m.tokensUsed || undefined,
      createdAt: m.createdAt,
    }));
  }

  /**
   * Add user message
   */
  async addUserMessage(
    conversationId: string,
    question: string
  ): Promise<Message> {
    const message = await db.aIMessage.create({
      data: {
        conversationId,
        role: "user",
        question,
      },
    });

    return {
      id: message.id,
      conversation_id: message.conversationId,
      role: "user",
      question,
      created_at: message.createdAt,
    };
  }

  /**
   * Build context from conversation history
   * For multi-turn conversations
   */
  buildConversationContext(messages: Message[]): string {
    let context = "";

    for (const msg of messages) {
      if (msg.role === "user") {
        context += `User: ${msg.question}\n`;
      } else if (msg.answer) {
        context += `Assistant: ${msg.answer}\n`;
      }
      context += "\n";
    }

    return context;
  }

  /**
   * Truncate old conversations (cleanup)
   */
  async cleanupOldConversations(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await db.aIConversation.deleteMany({
      where: {
        updatedAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  /**
   * Get conversation statistics
   */
  async getConversationStats(userId: string): Promise<{
    totalConversations: number;
    totalMessages: number;
    averageMessagesPerConversation: number;
    lastConversationDate: Date | null;
  }> {
    const conversations = await db.aIConversation.findMany({
      where: { userId },
      include: {
        messages: true,
      },
    });

    const totalConversations = conversations.length;
    const totalMessages = conversations.reduce(
      (sum: number, c: any) => sum + c.messages.length,
      0
    );
    const averageMessagesPerConversation =
      totalConversations > 0 ? totalMessages / totalConversations : 0;
    const lastConversationDate =
      conversations.length > 0
        ? conversations[conversations.length - 1].updatedAt
        : null;

    return {
      totalConversations,
      totalMessages,
      averageMessagesPerConversation,
      lastConversationDate,
    };
  }
}

// Singleton
let manager: ConversationManager | null = null;

export function getConversationManager(): ConversationManager {
  if (!manager) {
    manager = new ConversationManager();
  }
  return manager;
}

