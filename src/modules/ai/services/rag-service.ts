import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { getKnowledgeCorpusVersion, searchKnowledgeChunks } from "../repositories/knowledge-repo";
import type { AiCitation } from "../types";
import { generateWithChatEndpoint } from "./openai-chat-client";
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
  const isProcessQuestion = /quy trình|process|phê duyệt|approval|hard\s*stop|sla|chứng từ|chung tu|hoàn ứng|hoan ung/i.test(question);
  if (!isProcessQuestion || knowledgeChunks.length === 0) return null;

  const preferredChunk =
    knowledgeChunks.find((item) => /mock_quy_trinh_phe_duyet_chi_phi\.txt/i.test(item.source)) ??
    knowledgeChunks.find((item) => /mock_nghiep_vu_hoan_ung_cong_tac\.txt/i.test(item.source)) ??
    knowledgeChunks.find((item) => /mock_tai_lieu_mat_noi_bo_gia_lap\.txt/i.test(item.source)) ??
    knowledgeChunks.find((item) => /quy_trinh|phe_duyet|approval|process|hoan_ung|chung_tu/i.test(item.source)) ??
    knowledgeChunks.find((item) => /\b(bước|buoc)\s*\d+\s*:/im.test(item.content)) ??
    knowledgeChunks[0];

  const lines = preferredChunk.content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const stepLines = extractStepLines(preferredChunk.content);

  const entityPattern = /\bmanager\b/i.test(question)
    ? /\bmanager\b/i
    : /\bauditor\b/i.test(question)
      ? /\bauditor\b/i
      : /\baccountant\b/i.test(question)
        ? /\baccountant\b/i
        : /finance[_\s-]*admin/i.test(question)
          ? /finance[_\s-]*admin/i
          : null;

  if (entityPattern) {
    const entityLines = lines.filter((line) => entityPattern.test(line)).slice(0, 3);
    if (entityLines.length > 0) {
      return entityLines.join(" ");
    }
  }

  if (/hard\s*stop|100%/i.test(question)) {
    const hardStopLines = lines.filter((line) => /hard\s*stop|100%|chặn tạo yêu cầu|chan tao yeu cau/i.test(line)).slice(0, 3);
    if (hardStopLines.length > 0) {
      return hardStopLines.join(" ");
    }
  }

  if (/sla|dưới\s*10|duoi\s*10|từ\s*10|tu\s*10/i.test(question)) {
    const slaLines = lines.filter((line) => /sla|10\.000\.000|4 giờ|1 ngày/i.test(line)).slice(0, 3);
    if (slaLines.length > 0) {
      return slaLines.join(" ");
    }
  }

  if (/chứng từ|chung tu|bộ chứng từ|bo chung tu/i.test(question)) {
    const evidenceLines = lines.filter((line) => /chứng từ|chung tu|hóa đơn|hoa don|vé tàu|ve tau|quyết định|quyet dinh/i.test(line)).slice(0, 5);
    if (evidenceLines.length > 0) {
      return evidenceLines.join(" ");
    }
  }

  if (/hoàn ứng|hoan ung|07\s*ngày|07\s*ngay|7\s*ngày|7\s*ngay/i.test(question)) {
    const settlementLines = lines.filter((line) => /07\s*ngày|07\s*ngay|7\s*ngày|7\s*ngay|hoàn ứng|hoan ung|quyết toán|quyet toan/i.test(line)).slice(0, 4);
    if (settlementLines.length > 0) {
      return settlementLines.join(" ");
    }
  }

  if (stepLines.length > 0) {
    return stepLines.join(" ");
  }

  const keyLines = lines
    .filter((line) => /(manager|accountant|finance_admin|auditor|hard-stop|sla|phê duyệt|phe duyet)/i.test(line))
    .slice(0, 4);

  if (keyLines.length > 0) {
    return keyLines.join(" ");
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
    return stepLines.join(" ");
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
    return "Mình là BudgetFlow AI Assistant, hỗ trợ tra cứu ngân sách, giao dịch, phê duyệt, báo cáo và hướng dẫn thao tác trong hệ thống.";
  }

  const processAnswer = buildProcessAnswerFromChunks(question, knowledgeChunks);
  if (processAnswer) {
    return processAnswer;
  }

  const firstKnowledgeLine = knowledgeChunks
    .flatMap((chunk) => chunk.content.split("\n"))
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (firstKnowledgeLine) {
    return `Theo tài liệu nội bộ mình tìm được: ${firstKnowledgeLine}`;
  }

  if (!context.trim()) {
    return "Mình chưa có đủ nguồn nội bộ để trả lời trực tiếp câu hỏi này. Bạn vui lòng bổ sung phạm vi (phòng ban/thời gian/chức năng) để mình truy xuất chính xác hơn.";
  }

  return `Mình chưa thấy đủ dữ kiện trong tài liệu nội bộ để kết luận cho câu hỏi "${question}". Bạn hãy nêu rõ thêm phạm vi hoặc mục tiêu cần tra cứu.`;
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
    answer = (await generateWithChatEndpoint(prompt)) ?? fallbackAnswer(question, context, knowledgeChunks);
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
