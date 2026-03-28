/**
 * Conversation Manager Service
 * Manages conversation history and multi-turn context
 */

import { randomUUID } from "crypto";
import { Conversation, Message } from "../types";

export class ConversationManager {
  private conversations: Map<string, Conversation> = new Map();
  private messages: Map<string, Message[]> = new Map();

  async createConversation(userId: string, title?: string): Promise<Conversation> {
    const conversationId = randomUUID();
    const now = new Date();

    const conversation: Conversation = {
      id: conversationId,
      user_id: userId,
      title,
      created_at: now,
      updated_at: now,
    };

    this.conversations.set(conversationId, conversation);
    this.messages.set(conversationId, []);

    return conversation;
  }

  async getConversation(conversationId: string): Promise<Conversation | undefined> {
    return this.conversations.get(conversationId);
  }

  async getUserConversations(
    userId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<Conversation[]> {
    const userConvs = Array.from(this.conversations.values()).filter(
      (c) => c.user_id === userId
    );

    userConvs.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());

    return userConvs.slice(offset, offset + limit);
  }

  async updateConversationTitle(conversationId: string, title: string): Promise<void> {
    const conv = this.conversations.get(conversationId);
    if (conv) {
      conv.title = title;
      conv.updated_at = new Date();
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    this.conversations.delete(conversationId);
    this.messages.delete(conversationId);
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    return this.messages.get(conversationId) || [];
  }

  async getRecentMessages(conversationId: string, limit: number = 5): Promise<Message[]> {
    const msgs = this.messages.get(conversationId) || [];
    return limit > 0 ? msgs.slice(-limit) : msgs;
  }

  async addUserMessage(
    conversationId: string,
    question: string
  ): Promise<Message> {
    const messageId = randomUUID();
    const now = new Date();

    const message: Message = {
      id: messageId,
      conversation_id: conversationId,
      role: "user",
      question,
      created_at: now,
    };

    if (!this.messages.has(conversationId)) {
      this.messages.set(conversationId, []);
    }

    this.messages.get(conversationId)!.push(message);

    const conv = this.conversations.get(conversationId);
    if (conv) {
      conv.updated_at = now;
    }

    return message;
  }

  async addAssistantMessage(
    conversationId: string,
    question: string,
    answer: string,
    citations?: Array<{ source: string; reference?: Record<string, any> }>,
    processingTimeMs?: number,
    tokensUsed?: number
  ): Promise<Message> {
    const messageId = randomUUID();
    const now = new Date();

    const message: Message = {
      id: messageId,
      conversation_id: conversationId,
      role: "assistant",
      question,
      answer,
      citations,
      processing_time_ms: processingTimeMs,
      tokens_used: tokensUsed,
      created_at: now,
    };

    if (!this.messages.has(conversationId)) {
      this.messages.set(conversationId, []);
    }

    this.messages.get(conversationId)!.push(message);

    const conv = this.conversations.get(conversationId);
    if (conv) {
      conv.updated_at = now;
    }

    return message;
  }

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
}
