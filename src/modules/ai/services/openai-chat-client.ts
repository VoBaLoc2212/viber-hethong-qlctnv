const AI_CHAT_ENDPOINT = process.env.AI_CHAT_ENDPOINT?.trim();
const AI_CHAT_API_KEY = process.env.AI_CHAT_API_KEY?.trim();
const AI_CHAT_MODEL = process.env.AI_CHAT_MODEL?.trim();
const AI_TEMPERATURE = Number(process.env.AI_TEMPERATURE ?? 0.2);
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 30000);

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
  if (!AI_CHAT_ENDPOINT || !AI_CHAT_API_KEY || !AI_CHAT_MODEL) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number.isFinite(AI_TIMEOUT_MS) && AI_TIMEOUT_MS > 0 ? AI_TIMEOUT_MS : 30000,
  );

  try {
    const response = await fetch(AI_CHAT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_CHAT_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_CHAT_MODEL,
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
      return null;
    }

    const payload = (await response.json()) as OpenAiChatResponse;
    const content = payload.choices?.[0]?.message?.content;
    return resolveMessageContent(content);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
