import { ApiCall, RetrievedData, UserContext } from "@/modules/ai/types";

interface FetchOptions {
  headers?: Record<string, string>;
  timeout?: number;
}

export class DataRetriever {
  private baseUrl: string;
  private defaultTimeout = 30000;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || "";
  }

  async fetchData(
    call: ApiCall,
    userContext: UserContext,
    options?: FetchOptions
  ): Promise<RetrievedData> {
    const start = Date.now();

    try {
      const params = this.mergeParams(call.params || {}, userContext);
      const url = this.buildUrl(call.endpoint, params);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-user-id": userContext.user_id,
        "x-user-role": userContext.role,
        ...(options?.headers || {}),
      };

      if (userContext.auth_token) {
        headers["Authorization"] = `Bearer ${userContext.auth_token}`;
      }

      const res = await this.fetchWithTimeout(
        url,
        { method: call.method || "GET", headers },
        options?.timeout || this.defaultTimeout
      );

      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      const time = Date.now() - start;

      return {
        source: call.endpoint,
        data,
        fetch_time: time,
        fetchTime: time,
      };
    } catch (err) {
      const time = Date.now() - start;

      return {
        source: call.endpoint,
        data: null,
        fetch_time: time,
        fetchTime: time,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async fetchMultiple(
    calls: ApiCall[],
    userContext: UserContext
  ): Promise<RetrievedData[]> {
    return Promise.all(
      calls.map((c) => this.fetchData(c, userContext))
    );
  }

  private buildUrl(endpoint: string, params: Record<string, any>): string {
    const base =
      this.baseUrl ||
      (typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");

    const url = new URL(endpoint, base);

    Object.entries(params).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        v.forEach((val) => url.searchParams.append(k, String(val)));
      } else if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    });

    return url.toString();
  }

  private fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> {
    return Promise.race([
      fetch(url, options),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeout)
      ),
    ]);
  }

  private mergeParams(
    apiParams: Record<string, any>,
    userContext: UserContext
  ) {
    const filters = userContext.filters;
    const merged = { ...apiParams };

    const budget =
      filters.budgetFilter || filters.budget_filter || { extra: {} };
    const transaction =
      filters.transactionFilter ||
      filters.transaction_filter || { extra: {} };

    if (budget.departments && !merged.departments) {
      merged.departments = budget.departments;
    }

    if (budget.categories && !merged.categories) {
      merged.categories = budget.categories;
    }

    if (transaction.departments && !merged.departments) {
      merged.departments = transaction.departments;
    }

    if (transaction.statuses && !merged.statuses) {
      merged.statuses = transaction.statuses;
    }

    return merged;
  }
}

// singleton
let instance: DataRetriever | null = null;

export const getDataRetriever = () => {
  if (!instance) instance = new DataRetriever();
  return instance;
};