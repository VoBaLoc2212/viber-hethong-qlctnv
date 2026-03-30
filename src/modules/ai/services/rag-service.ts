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
  resolve(process.cwd(), "docs/mock_quy_trinh_phe_duyet_chi_phi.txt"),
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

async function loadStaticContext(): Promise<{ context: string; citations: AiCitation[] }> {
  const chunks = await Promise.all(
    DOC_PATHS.map(async (path) => {
      try {
        const content = await readFile(path, "utf-8");
        const fileName = path.split(/[\\/]/).pop() ?? path;
        return {
          context: `# ${fileName}\n${content}`,
          citation: {
            source: `docs/${fileName}`,
            snippet: `Static context from ${fileName}`,
          } satisfies AiCitation,
        };
      } catch {
        return null;
      }
    }),
  );

  const ready = chunks.filter((item): item is { context: string; citation: AiCitation } => Boolean(item));
  return {
    context: ready.map((item) => item.context).join("\n\n"),
    citations: ready.map((item) => item.citation),
  };
}

function extractStepLines(content: string) {
  const byLine = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => /^(bước|buoc)\s*\d+\s*:/i.test(line));

  if (byLine.length > 0) {
    return byLine.slice(0, 5);
  }

  const flattenedMatches = [...content.matchAll(/(?:^|\s)((?:bước|buoc)\s*\d+\s*:[^\n]*?)(?=(?:\s(?:bước|buoc)\s*\d+\s*:)|$)/gi)]
    .map((match) => (match[1] ?? "").trim())
    .filter(Boolean)
    .slice(0, 5);

  return flattenedMatches;
}

function buildProcessAnswerFromChunks(
  question: string,
  knowledgeChunks: Array<{ source: string; snippet: string; content: string }>,
): string | null {
  const isProcessQuestion = /quy trình|process|phê duyệt|approval/i.test(question);
  if (!isProcessQuestion || knowledgeChunks.length === 0) return null;

  const preferredChunk =
    knowledgeChunks.find((item) => /mock_quy_trinh_phe_duyet_chi_phi\.txt/i.test(item.source)) ??
    knowledgeChunks.find((item) => /quy_trinh|phe_duyet|approval|process/i.test(item.source)) ??
    knowledgeChunks.find((item) => /\b(bước|buoc)\s*\d+\s*:/im.test(item.content)) ??
    knowledgeChunks[0];

  const lines = preferredChunk.content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const stepLines = extractStepLines(preferredChunk.content);

  if (stepLines.length > 0) {
    return `${stepLines.join(" ")} Bạn có thể vào trang Help để xem đầy đủ hướng dẫn và chính sách quyền truy cập.`;
  }

  const keyLines = lines
    .filter((line) => /(manager|accountant|finance_admin|hard-stop|sla|phê duyệt|phe duyet)/i.test(line))
    .slice(0, 4);

  if (keyLines.length > 0) {
    return `${keyLines.join(" ")} Bạn có thể vào trang Help để xem đầy đủ hướng dẫn và chính sách quyền truy cập.`;
  }

  return null;
}

function buildProcessAnswerFromStaticContext(question: string, staticContext: string): string | null {
  const isProcessQuestion = /quy trình|process|phê duyệt|approval/i.test(question);
  if (!isProcessQuestion || !staticContext.trim()) return null;

  const marker = "# mock_quy_trinh_phe_duyet_chi_phi.txt";
  const idx = staticContext.indexOf(marker);
  if (idx < 0) return null;

  const section = staticContext.slice(idx + marker.length);
  const nextDocIdx = section.indexOf("\n# ");
  const content = (nextDocIdx >= 0 ? section.slice(0, nextDocIdx) : section).trim();

  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const stepLines = lines
    .filter((line) => /^(bước|buoc)\s*\d+\s*:/i.test(line))
    .slice(0, 5);

  if (stepLines.length > 0) {
    return `${stepLines.join(" ")} Bạn có thể vào trang Help để xem đầy đủ hướng dẫn và chính sách quyền truy cập.`;
  }

  return null;
}

function fallbackAnswer(
  question: string,
  context: string,
  knowledgeChunks: Array<{ source: string; snippet: string; content: string }>,
) {
  const normalizedQuestion = question.trim().toLowerCase();

  if (/\bbạn là ai\b|who are you|ban la ai/.test(normalizedQuestion)) {
    return "Mình là BudgetFlow AI Assistant, hỗ trợ tra cứu ngân sách, giao dịch, phê duyệt, báo cáo và hướng dẫn thao tác trong hệ thống. Bạn có thể vào trang Help để xem hướng dẫn chi tiết theo từng chức năng.";
  }

  const processAnswer = buildProcessAnswerFromChunks(question, knowledgeChunks);
  if (processAnswer) {
    return processAnswer;
  }

  if (!context.trim()) {
    return "Hiện chưa có nguồn tài liệu nội bộ đủ để trả lời trực tiếp câu hỏi này. Bạn có thể vào trang Help để xem hướng dẫn thao tác và chính sách quyền truy cập.";
  }

  return `Mình đã tra cứu tài liệu nội bộ cho câu hỏi \"${question}\". Bạn có thể vào trang Help để xem hướng dẫn chi tiết và chính sách quyền truy cập.`;
}

export async function resolveByRag(
  question: string,
  auth?: { userId: string; role: "EMPLOYEE" | "MANAGER" | "ACCOUNTANT" | "FINANCE_ADMIN" | "AUDITOR"; email: string },
  options?: { conversationMessages?: Array<{ role: string; content: string }> },
): Promise<{ answer: string; citations: AiCitation[] }> {
  const role = auth?.role ?? "EMPLOYEE";
  const conversationContext = buildConversationContext(options?.conversationMessages ?? []);
  const corpusVersion = await getKnowledgeCorpusVersion();
  const ragResponseVersion = "rag-response-v4";
  const cacheCorpusVersion = `${ragResponseVersion}:${corpusVersion}`;
  const contextDigest = hash(conversationContext || "none");

  const cached = await getRagCache({
    role,
    message: question,
    contextDigest,
    corpusVersion: cacheCorpusVersion,
  });
  if (cached) {
    return cached;
  }

  const knowledgeChunks = await searchKnowledgeChunks(`${question}\n${conversationContext}`, 8, { minScore: 2 });
  const { context: staticContext, citations: staticCitations } = await loadStaticContext();

  const citationsFromKnowledge: AiCitation[] = knowledgeChunks.map((item) => ({
    source: item.source,
    snippet: item.snippet,
  }));
  const hasKnowledgeEvidence = knowledgeChunks.length > 0;

  const retrievedContext = knowledgeChunks
    .map((item, index) => `# Chunk ${index + 1} (${item.source} - ${item.snippet})\n${item.content}`)
    .join("\n\n");

  const context = [retrievedContext, hasKnowledgeEvidence ? "" : staticContext]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 12000);

  const processAnswer =
    buildProcessAnswerFromChunks(question, knowledgeChunks) ??
    buildProcessAnswerFromStaticContext(question, hasKnowledgeEvidence ? "" : staticContext);

  let answer: string;
  if (processAnswer) {
    answer = processAnswer;
  } else {
    const systemPrompt = auth ? buildSystemPrompt(auth) : undefined;
    const prompt = buildRagPrompt(question, context, systemPrompt, conversationContext);
    answer = (await generateWithGemini(prompt)) ?? fallbackAnswer(question, context, knowledgeChunks);
  }

  const citations = (hasKnowledgeEvidence ? citationsFromKnowledge : staticCitations).slice(0, 8);

  const result = { answer, citations };
  await setRagCache(
    {
      role,
      message: question,
      contextDigest,
      corpusVersion: cacheCorpusVersion,
    },
    result,
  );

  return result;
}
