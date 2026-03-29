import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { getKnowledgeCorpusVersion, searchKnowledgeChunks } from "../repositories/knowledge-repo";
import type { AiCitation } from "../types";
import { generateWithGemini } from "./gemini-client";
import { getRagCache, setRagCache } from "./memory-service";
import { buildRagPrompt, buildSystemPrompt } from "./prompt-builder";

const DOC_PATHS = [
  resolve(process.cwd(), "docs/context.md"),
  resolve(process.cwd(), "docs/AI_RULES.md"),
  resolve(process.cwd(), "docs/BUSINESS_FLOW.md"),
  resolve(process.cwd(), "docs/DOMAIN_DESIGN.md"),
];

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function buildConversationContext(messages: Array<{ role: string; content: string }>): string {
  return messages
    .slice(-8)
    .map((row) => `${row.role}: ${row.content}`)
    .join("\n")
    .slice(0, 2400);
}

async function loadStaticContext() {
  const chunks = await Promise.all(
    DOC_PATHS.map(async (path) => {
      try {
        const content = await readFile(path, "utf-8");
        return `# ${path.split(/[\\/]/).pop()}\n${content}`;
      } catch {
        return "";
      }
    }),
  );

  return chunks.filter(Boolean).join("\n\n");
}

function fallbackAnswer(question: string, context: string) {
  if (!context.trim()) {
    return "Hiện chưa có nguồn tài liệu nội bộ để trả lời câu hỏi hướng dẫn này.";
  }

  return `Mình đã tra cứu tài liệu nội bộ. Với câu hỏi \"${question}\", bạn có thể vào trang Help để xem hướng dẫn thao tác và chính sách quyền truy cập.`;
}

export async function resolveByRag(
  question: string,
  auth?: { userId: string; role: "EMPLOYEE" | "MANAGER" | "ACCOUNTANT" | "FINANCE_ADMIN" | "AUDITOR"; email: string },
  options?: { conversationMessages?: Array<{ role: string; content: string }> },
): Promise<{ answer: string; citations: AiCitation[] }> {
  const role = auth?.role ?? "EMPLOYEE";
  const conversationContext = buildConversationContext(options?.conversationMessages ?? []);
  const corpusVersion = await getKnowledgeCorpusVersion();
  const contextDigest = hash(conversationContext || "none");

  const cached = await getRagCache({
    role,
    message: question,
    contextDigest,
    corpusVersion,
  });
  if (cached) {
    return cached;
  }

  const knowledgeChunks = await searchKnowledgeChunks(`${question}\n${conversationContext}`, 8);
  const staticContext = await loadStaticContext();

  const retrievedContext = knowledgeChunks
    .map((item, index) => `# Chunk ${index + 1} (${item.source} - ${item.snippet})\n${item.content}`)
    .join("\n\n");

  const context = [retrievedContext, staticContext]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 12000);

  const systemPrompt = auth ? buildSystemPrompt(auth) : undefined;
  const prompt = buildRagPrompt(question, context, systemPrompt, conversationContext);
  const answer = (await generateWithGemini(prompt)) ?? fallbackAnswer(question, context);

  const citationsFromKnowledge: AiCitation[] = knowledgeChunks.map((item) => ({
    source: item.source,
    snippet: item.snippet,
  }));

  const citationsFromDocs: AiCitation[] = [
    {
      source: "docs/context.md",
      snippet: "Project overview, modules, API, auth, and usage notes",
    },
    {
      source: "docs/AI_RULES.md",
      snippet: "AI policy, endpoint contract, and UAT prompts",
    },
    {
      source: "docs/BUSINESS_FLOW.md",
      snippet: "Business workflow and approval flow",
    },
  ];

  const citations = [...citationsFromKnowledge, ...citationsFromDocs].slice(0, 8);

  const result = { answer, citations };
  await setRagCache(
    {
      role,
      message: question,
      contextDigest,
      corpusVersion,
    },
    result,
  );

  return result;
}
