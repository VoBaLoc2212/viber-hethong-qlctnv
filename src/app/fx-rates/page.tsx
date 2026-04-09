"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useGetFxRates } from "@/lib/api-client";
import { useAuthSession } from "@/components/auth-session-provider";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const LIMIT = 20;

export default function FxRatesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { token, currentUser, initializing } = useAuthSession();

  const [q, setQ] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [rateDateFrom, setRateDateFrom] = useState("");
  const [rateDateTo, setRateDateTo] = useState("");
  const [page, setPage] = useState(1);

  const isFinanceAdmin = currentUser?.role === "FINANCE_ADMIN";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setQ(params.get("q")?.trim() ?? "");
    setSourceFilter(params.get("source")?.trim() ?? "");
    setRateDateFrom(params.get("rateDateFrom")?.trim() ?? "");
    setRateDateTo(params.get("rateDateTo")?.trim() ?? "");
    setPage(Math.max(1, Number(params.get("page") ?? 1) || 1));
  }, [pathname]);

  const { data, isLoading, error } = useGetFxRates(
    {
      page,
      limit: LIMIT,
      q: q || undefined,
      source: sourceFilter || undefined,
      fromCurrency: "USD",
      toCurrency: "VND",
      rateDateFrom: rateDateFrom || undefined,
      rateDateTo: rateDateTo || undefined,
    },
    {
      enabled: !initializing && Boolean(token) && isFinanceAdmin,
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const summary = useMemo(() => {
    if (!q && !sourceFilter && !rateDateFrom && !rateDateTo) {
      return "Hiển thị lịch sử tỷ giá USD/VND được hệ thống tự động cập nhật từ nguồn web.";
    }

    return "Đang lọc theo điều kiện tìm kiếm hiện tại.";
  }, [q, sourceFilter, rateDateFrom, rateDateTo]);

  function navigateWithParams(next: {
    q?: string;
    source?: string;
    rateDateFrom?: string;
    rateDateTo?: string;
    page?: number;
  }) {
    const params = new URLSearchParams();

    const nextQ = (next.q ?? q).trim();
    const nextSource = (next.source ?? sourceFilter).trim();
    const nextRateDateFrom = (next.rateDateFrom ?? rateDateFrom).trim();
    const nextRateDateTo = (next.rateDateTo ?? rateDateTo).trim();
    const nextPage = next.page ?? page;

    if (nextQ) params.set("q", nextQ);
    if (nextSource) params.set("source", nextSource);
    if (nextRateDateFrom) params.set("rateDateFrom", nextRateDateFrom);
    if (nextRateDateTo) params.set("rateDateTo", nextRateDateTo);
    if (nextPage > 1) params.set("page", String(nextPage));

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);

    setQ(nextQ);
    setSourceFilter(nextSource);
    setRateDateFrom(nextRateDateFrom);
    setRateDateTo(nextRateDateTo);
    setPage(Math.max(1, nextPage));
  }

  function handleFilterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    navigateWithParams({
      q: String(form.get("q") ?? ""),
      source: String(form.get("source") ?? ""),
      rateDateFrom: String(form.get("rateDateFrom") ?? ""),
      rateDateTo: String(form.get("rateDateTo") ?? ""),
      page: 1,
    });
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Quản lý tỷ giá</h1>
        <p className="mt-1 text-muted-foreground">
          Tỷ giá USD/VND được hệ thống tự động cập nhật từ nguồn web và dùng cho quy đổi giao dịch.
        </p>
      </div>

      {!isFinanceAdmin ? (
        <Alert>
          <AlertDescription>Chỉ FINANCE_ADMIN mới có quyền xem màn hình tỷ giá.</AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <AlertDescription>
            Chế độ nhập/sửa thủ công đã tắt. Hệ thống tự động lấy tỷ giá hiện tại và lưu lịch sử.
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Bộ lọc tỷ giá</CardTitle>
          <CardDescription>{summary}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-5" onSubmit={handleFilterSubmit}>
            <Input name="q" defaultValue={q} placeholder="Tìm theo mã tiền tệ/nguồn" />
            <Input name="source" defaultValue={sourceFilter} placeholder="Nguồn (ví dụ WEB_OPEN_ER_API)" />
            <Input name="rateDateFrom" defaultValue={rateDateFrom} type="date" />
            <Input name="rateDateTo" defaultValue={rateDateTo} type="date" />
            <Button type="submit">Lọc</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Danh sách tỷ giá USD/VND</CardTitle>
          <CardDescription>
            Trang {page}/{totalPages} • Tổng {total} bản ghi
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!initializing && token && isFinanceAdmin && error ? <p className="text-sm text-destructive">{error.message}</p> : null}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Đang tải dữ liệu tỷ giá...</p>
          ) : data?.data.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày áp dụng</TableHead>
                  <TableHead>Cặp tiền</TableHead>
                  <TableHead>Tỷ giá</TableHead>
                  <TableHead>Nguồn</TableHead>
                  <TableHead>Thời điểm cập nhật</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell>{new Date(rate.rateDate).toLocaleDateString("vi-VN")}</TableCell>
                    <TableCell>
                      {rate.fromCurrency}/{rate.toCurrency}
                    </TableCell>
                    <TableCell>{rate.rate}</TableCell>
                    <TableCell>{rate.source}</TableCell>
                    <TableCell>{new Date(rate.updatedAt).toLocaleString("vi-VN")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có bản ghi tỷ giá phù hợp.</p>
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
