type CacheValue = Record<string, unknown> | string | number | boolean | null;

function getConfig() {
  const url = process.env.REDIS_URL?.trim();
  const token = process.env.REDIS_TOKEN?.trim();

  if (!url || !token || !/^https?:\/\//i.test(url)) {
    return null;
  }

  return {
    url: url.replace(/\/$/, ""),
    token,
  };
}

async function command(args: string[]) {
  const config = getConfig();
  if (!config) {
    return null;
  }

  const path = args.map((part) => encodeURIComponent(part)).join("/");
  const response = await fetch(`${config.url}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`REDIS_HTTP_${response.status}`);
  }

  return (await response.json()) as { result?: unknown };
}

export async function getCacheJson<T>(key: string): Promise<T | null> {
  const payload = await command(["get", key]);
  const value = payload?.result;

  if (typeof value !== "string") {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function setCacheJson(key: string, value: CacheValue, ttlSeconds: number) {
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    return;
  }

  await command(["setex", key, String(Math.floor(ttlSeconds)), JSON.stringify(value)]);
}

export async function deleteCacheKey(key: string) {
  await command(["del", key]);
}
