"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useGetTransactions } from "@/lib/api-client";
import { getTransactionStatusLabel, getTransactionTypeLabel } from "@/lib/ui-labels";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function TransactionsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setQ(params.get("q")?.trim() ?? "");
    setPage(Math.max(1, Number(params.get("page") ?? 1) || 1));
  }, [pathname]);

  const { data, isLoading, error } = useGetTransactions({ page, limit, q: q || undefined });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const summary = useMemo(() => {
    if (!q) return "Hiển thị toàn bộ giao dịch.";
    return `Kết quả tìm kiếm cho “${q}”.`;
  }, [q]);

  function navigateWithParams(next: { q?: string; page?: number }) {
    const params = new URLSearchParams();

    const nextQ = (next.q ?? q).trim();
    const nextPage = next.page ?? page;

    if (nextQ) params.set("q", nextQ);
    if (nextPage > 1) params.set("page", String(nextPage));

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
    setQ(nextQ);
    setPage(Math.max(1, nextPage));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const keyword = String(form.get("q") ?? "");
    navigateWithParams({ q: keyword, page: 1 });
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Giao dịch</h1>
        <p className="mt-1 text-muted-foreground">Tra cứu và theo dõi danh sách giao dịch theo từ khóa.</p>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Tìm kiếm giao dịch</CardTitle>
          <CardDescription>{summary}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
            <Input name="q" defaultValue={q} placeholder="Nhập mã hoặc mô tả giao dịch" className="sm:max-w-md" />
            <Button type="submit">Tìm kiếm</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Danh sách giao dịch</CardTitle>
          <CardDescription>
            Trang {page}/{totalPages} • Tổng {total} giao dịch
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <p className="text-sm text-destructive">{error.message}</p> : null}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Đang tải dữ liệu giao dịch...</p>
          ) : data?.data.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã giao dịch</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Số tiền</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ngày</TableHead>
                  <TableHead>Mô tả</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{tx.transactionCode}</TableCell>
                    <TableCell>{getTransactionTypeLabel(tx.type)}</TableCell>
                    <TableCell>{tx.amount}</TableCell>
                    <TableCell>{getTransactionStatusLabel(tx.status)}</TableCell>
                    <TableCell>{new Date(tx.date).toLocaleString("vi-VN")}</TableCell>
                    <TableCell>{tx.description ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">Không tìm thấy giao dịch phù hợp.</p>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => navigateWithParams({ page: page - 1 })} disabled={page <= 1 || isLoading}>
              Trang trước
            </Button>
            <Button
              variant="outline"
              onClick={() => navigateWithParams({ page: page + 1 })}
              disabled={page >= totalPages || isLoading}
            >
              Trang sau
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
