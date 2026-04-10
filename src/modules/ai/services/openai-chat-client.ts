const AI_CHAT_API_KEY = process.env.AI_CHAT_API_KEY?.trim();
const AI_CHAT_MODEL = process.env.AI_CHAT_MODEL?.trim();
const AI_GEMINI_API_KEY = process.env.AI_GEMINI_API_KEY?.trim();
const AI_GEMINI_MODEL = process.env.AI_GEMINI_MODEL?.trim();
const AI_TEMPERATURE = Number(process.env.AI_TEMPERATURE ?? 0.2);
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 30000);

type ChatProvider = {
  endpoint: string;
  apiKey: string;
  model: string;
};

function resolveChatEndpoint(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const normalized = raw.replace(/\/+$/, "");
  if (normalized.endsWith("/chat/completions")) return normalized;
  if (normalized.endsWith("/v1")) return `${normalized}/chat/completions`;
  return `${normalized}/v1/chat/completions`;
}

function resolveProviders(): ChatProvider[] {
  const primaryEndpoint = resolveChatEndpoint(process.env.AI_CHAT_ENDPOINT?.trim() || process.env.AI_CHAT_BASE_URL?.trim());
  const geminiEndpoint = resolveChatEndpoint(
    process.env.AI_GEMINI_ENDPOINT?.trim() || process.env.AI_GEMINI_BASE_URL?.trim() || process.env.AI_CHAT_ENDPOINT?.trim() || process.env.AI_CHAT_BASE_URL?.trim(),
  );

  const providers: ChatProvider[] = [];

  if (primaryEndpoint && AI_CHAT_API_KEY && AI_CHAT_MODEL) {
    providers.push({
      endpoint: primaryEndpoint,
      apiKey: AI_CHAT_API_KEY,
      model: AI_CHAT_MODEL,
    });
  }

  if (geminiEndpoint && AI_GEMINI_API_KEY && AI_GEMINI_MODEL) {
    providers.push({
      endpoint: geminiEndpoint,
      apiKey: AI_GEMINI_API_KEY,
      model: AI_GEMINI_MODEL,
    });
  }

  return providers;
}

type OpenAiChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }>;
    };
  }>;
};

function resolveMessageContent(content: string | Array<{ text?: string }> | undefined): string | null {
  if (!content) return null;

  if (typeof content === "string") {
    const normalized = content.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (Array.isArray(content)) {
    const normalized = content
      .map((part) => part.text ?? "")
      .join("\n")
      .trim();
    return normalized.length > 0 ? normalized : null;
  }

  return null;
}

export async function generateWithChatEndpoint(prompt: string): Promise<string | null> {
  const providers = resolveProviders();
  if (providers.length === 0) {
    return null;
  }

  for (const provider of providers) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Number.isFinite(AI_TIMEOUT_MS) && AI_TIMEOUT_MS > 0 ? AI_TIMEOUT_MS : 30000,
    );

    try {
      const response = await fetch(provider.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
          temperature: Number.isFinite(AI_TEMPERATURE) ? AI_TEMPERATURE : 0.2,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        continue;
      }

      const payload = (await response.json()) as OpenAiChatResponse;
      const content = resolveMessageContent(payload.choices?.[0]?.message?.content);
      if (content) {
        return content;
      }
    } catch {
      continue;
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}
