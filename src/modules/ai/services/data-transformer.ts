/**
 * Data Transformer Service
 * Normalizes and transforms raw API data into structured table format for LLM
 */

import { ColumnDef, DataSummary, DataType, RetrievedData, TransformedData } from "../types";

export class DataTransformer {
  transform(data: RetrievedData): TransformedData {
    if (data.error || data.data === null || data.data === undefined) {
      return {
        type: "table",
        columns: [],
        rows: [],
      };
    }

    const normalized = this.normalizeData(data.data);

    if (Array.isArray(normalized)) {
      return this.createTable(normalized, data.source);
    } else if (typeof normalized === "object") {
      return this.createMetric(normalized, data.source);
    }

    return { type: "table", columns: [], rows: [] };
  }

  transformMultiple(sources: RetrievedData[]): TransformedData[] {
    return sources.map((source) => this.transform(source));
  }

  private normalizeData(data: any): any {
    if (data === null || data === undefined) {
      return [];
    }

    if (typeof data === "object") {
      if ("data" in data) {
        return data.data;
      }
      if ("items" in data) {
        return data.items;
      }
    }

    return data;
  }

  private createTable(items: any[], source: string): TransformedData {
    if (!items || items.length === 0) {
      return { type: "table", columns: [], rows: [] };
    }

    const columns = this.inferColumns(items[0]);
    const rows = items.map((item) => this.formatRow(item, columns));
    const summary = this.calculateSummary(items, columns, source);

    return {
      type: "table",
      columns,
      rows,
      summary,
    };
  }

  private createMetric(data: Record<string, any>, source: string): TransformedData {
    return {
      type: "metric",
      columns: [],
      rows: [data],
      summary: this.formatMetric(data),
    };
  }

  private inferColumns(item: Record<string, any>): ColumnDef[] {
    const columns: ColumnDef[] = [];

    Object.entries(item).forEach(([key, value]) => {
      const dataType = this.inferDataType(value);
      columns.push({
        id: key,
        label: this.formatLabel(key),
        data_type: dataType,
        sortable: true,
      });
    });

    return columns;
  }

  private inferDataType(value: any): DataType {
    if (typeof value === "number") {
      return DataType.NUMBER;
    }
    if ((value instanceof Date) || (typeof value === "string" && this.isDate(value))) {
      return DataType.DATE;
    }
    if (typeof value === "boolean") {
      return DataType.STRING;
    }
    return DataType.STRING;
  }

  private isDate(str: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}/;
    return dateRegex.test(str);
  }

  private formatLabel(key: string): string {
    return key
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  private formatRow(item: Record<string, any>, columns: ColumnDef[]): Record<string, any> {
    const formatted: Record<string, any> = {};

    columns.forEach((col) => {
      const value = item[col.id];
      formatted[col.id] = this.formatValue(value, col.data_type);
    });

    return formatted;
  }

  private formatValue(value: any, dataType: DataType): string {
    if (value === null || value === undefined) {
      return "";
    }

    switch (dataType) {
      case DataType.CURRENCY:
        return this.formatCurrency(value);
      case DataType.DATE:
        return this.formatDate(value);
      case DataType.NUMBER:
      case DataType.PERCENTAGE:
        return this.formatNumber(value);
      default:
        return String(value);
    }
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value);
  }

  private formatDate(value: any): string {
    if (typeof value === "string") {
      return value;
    }
    if (value instanceof Date) {
      return value.toLocaleDateString("vi-VN");
    }
    return String(value);
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat("vi-VN").format(value);
  }

  private calculateSummary(
    items: any[],
    columns: ColumnDef[],
    source: string
  ): DataSummary | undefined {
    const numericColumn = columns.find((col) => col.data_type === DataType.NUMBER);

    if (!numericColumn) {
      return undefined;
    }

    const values = items
      .map((item) => item[numericColumn.id])
      .filter((v) => typeof v === "number");

    if (values.length === 0) {
      return undefined;
    }

    const total = values.reduce((sum, v) => sum + v, 0);
    const average = total / values.length;

    let trend: "UP" | "DOWN" | "STABLE" = "STABLE";
    if (values.length > 1) {
      const recent = values.slice(-Math.floor(values.length / 2));
      const older = values.slice(0, Math.floor(values.length / 2));
      const recentAvg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
      const olderAvg = older.reduce((sum, v) => sum + v, 0) / older.length;

      if (recentAvg > olderAvg * 1.1) {
        trend = "UP";
      } else if (recentAvg < olderAvg * 0.9) {
        trend = "DOWN";
      }
    }

    return {
      total,
      average,
      trend,
      anomalies: [],
    };
  }

  private formatMetric(data: Record<string, any>): DataSummary {
    return {
      total: typeof data.total === "number" ? data.total : undefined,
      average: typeof data.average === "number" ? data.average : undefined,
      trend: data.trend as "UP" | "DOWN" | "STABLE" | undefined,
      anomalies: [],
    };
  }
}
