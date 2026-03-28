import {
  ColumnDef,
  RetrievedData,
  TransformedData,
  DataType,
} from "@/modules/ai/types";

export class DataTransformer {
  transform(data: RetrievedData): TransformedData {
    if (data.error || !data.data) {
      return { type: "table", columns: [], rows: [] };
    }

    const normalized = this.normalize(data.data);

    if (Array.isArray(normalized)) {
      return this.toTable(normalized);
    }

    if (typeof normalized === "object") {
      return {
        type: "metric",
        summary: this.formatMetric(normalized),
      };
    }

    return { type: "table", columns: [], rows: [] };
  }

  private normalize(data: any) {
    if (data?.data) return data.data;
    return data;
  }

  private toTable(items: any[]): TransformedData {
    if (!items.length) return { type: "table", columns: [], rows: [] };

    const columns = this.inferColumns(items[0]);
    const rows = items.map((i) => this.formatRow(i, columns));

    return {
      type: "table",
      columns,
      rows,
      summary: this.calcSummary(items, columns),
    };
  }

  private inferColumns(obj: Record<string, any>): ColumnDef[] {
    return Object.entries(obj).map(([k, v]) =>
      this.inferColumn(k, v)
    );
  }

  private inferColumn(key: string, value: any): ColumnDef {
    let type: DataType = DataType.STRING;

    if (typeof value === "number") {
      type = this.isMoney(key) ? DataType.CURRENCY : DataType.NUMBER;
    } else if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) {
      type = DataType.DATE;
    }

    return {
      id: key,
      label: this.humanize(key),
      data_type: type,
      dataType: type,
      sortable: true,
    };
  }

  private formatRow(item: any, cols: ColumnDef[]) {
    const res: Record<string, any> = {};

    for (const col of cols) {
      let val = item[col.id];

      if (val == null) {
        res[col.id] = "-";
        continue;
      }

      switch (col.data_type) {
        case DataType.CURRENCY:
          res[col.id] = this.money(val);
          break;
        case DataType.NUMBER:
          res[col.id] = this.num(val);
          break;
        case DataType.DATE:
          res[col.id] = this.date(val);
          break;
        default:
          res[col.id] = String(val);
      }
    }

    return res;
  }

  private calcSummary(items: any[], cols: ColumnDef[]) {
    const numeric = cols.find((c) =>
      [DataType.NUMBER, DataType.CURRENCY].includes(c.data_type)
    );

    if (!numeric) return { total: items.length };

    const values = items
      .map((i) => Number(i[numeric.id]))
      .filter((n) => !isNaN(n));

    if (!values.length) return { total: items.length };

    const total = values.reduce((a, b) => a + b, 0);

    return {
      total,
      average: total / values.length,
    };
  }

  private formatMetric(obj: Record<string, any>) {
    const res: Record<string, any> = {};

    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "number") {
        res[k] = this.isMoney(k) ? this.money(v) : this.num(v);
      } else {
        res[k] = v;
      }
    }

    return res;
  }

  private num(v: number) {
    return v.toLocaleString("vi-VN");
  }

  private money(v: number) {
    return v.toLocaleString("vi-VN") + " VND";
  }

  private date(v: any) {
    return new Date(v).toLocaleDateString("vi-VN");
  }

  private isMoney(key: string) {
    return ["amount", "total", "cost", "price"].some((k) =>
      key.toLowerCase().includes(k)
    );
  }

  private humanize(k: string) {
    return k
      .replace(/_/g, " ")
      .replace(/([A-Z])/g, " $1")
      .trim();
  }
}

// singleton
let instance: DataTransformer | null = null;
export const getDataTransformer = () => {
  if (!instance) instance = new DataTransformer();
  return instance;
};