/**
 * Data Retriever Service
 * Fetches data from internal APIs with permission filters
 */

import { ApiCall, RetrievedData, UserContext, UserFilters } from "../types";

export class DataRetriever {
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:3001") {
    this.baseUrl = baseUrl;
  }

  async fetchData(
    call: ApiCall,
    userContext: UserContext,
    timeout: number = 30000
  ): Promise<RetrievedData> {
    const startTime = Date.now();

    try {
      const mergedParams = this.mergeParams(call.params || {}, userContext.filters);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-user-id": userContext.user_id,
        "x-user-role": userContext.role,
      };

      if (userContext.auth_token) {
        headers["Authorization"] = `Bearer ${userContext.auth_token}`;
      }

      const url = new URL(`${this.baseUrl}${call.endpoint}`);
      Object.entries(mergedParams).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((v) => url.searchParams.append(key, String(v)));
        } else if (value !== null && value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });

      const fetchTimeout = new AbortController();
      const timeoutId = setTimeout(() => fetchTimeout.abort(), timeout);

      try {
        const response = await fetch(url.toString(), {
          method: call.method || "GET",
          headers,
          signal: fetchTimeout.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const fetchTime = Date.now() - startTime;

        return {
          source: call.endpoint,
          data,
          fetch_time: fetchTime,
        };
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      const fetchTime = Date.now() - startTime;
      console.error(`Failed to fetch ${call.endpoint}:`, error);

      return {
        source: call.endpoint,
        data: null,
        fetch_time: fetchTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async fetchMultiple(
    calls: ApiCall[],
    userContext: UserContext,
    timeout: number = 30000
  ): Promise<RetrievedData[]> {
    const tasks = calls.map((call) => this.fetchData(call, userContext, timeout));
    return Promise.all(tasks);
  }

  private mergeParams(
    apiParams: Record<string, any>,
    filters: UserFilters
  ): Record<string, any> {
    const merged = { ...apiParams };

    if (filters.budget_filter?.departments?.length) {
      if (!merged.departments && !merged.department_id) {
        merged.departments = filters.budget_filter.departments;
      }
    }

    if (filters.budget_filter?.categories?.length) {
      if (!merged.categories && !merged.category) {
        merged.categories = filters.budget_filter.categories;
      }
    }

    if (filters.transaction_filter?.departments?.length) {
      if (!merged.departments && !merged.department_id) {
        merged.departments = filters.transaction_filter.departments;
      }
    }

    if (filters.transaction_filter?.statuses?.length) {
      if (!merged.statuses && !merged.status) {
        merged.statuses = filters.transaction_filter.statuses;
      }
    }

    return merged;
  }

  normalizeResponse(data: any): { items: any[] } {
    if (data === null || data === undefined) {
      return { items: [] };
    }

    if (typeof data === "object") {
      if ("data" in data) {
        if (Array.isArray(data.data)) {
          return { items: data.data };
        }
        return { items: [data.data] };
      }

      if ("items" in data) {
        if (Array.isArray(data.items)) {
          return data;
        }
        return { items: [data.items] };
      }
    }

    if (Array.isArray(data)) {
      return { items: data };
    }

    if (typeof data === "object") {
      return { items: [data] };
    }

    return { items: [] };
  }

  async aggregateData(
    calls: ApiCall[],
    userContext: UserContext
  ): Promise<{
    data: Record<string, any>;
    sources: RetrievedData[];
    error_count: number;
  }> {
    const results = await this.fetchMultiple(calls, userContext);

    const aggregated: {
      data: Record<string, any>;
      sources: RetrievedData[];
      error_count: number;
    } = {
      data: {},
      sources: results,
      error_count: 0,
    };

    for (const result of results) {
      if (result.error) {
        aggregated.error_count += 1;
        aggregated.data[result.source] = { error: result.error };
      } else {
        aggregated.data[result.source] = result.data;
      }
    }

    return aggregated;
  }
}
