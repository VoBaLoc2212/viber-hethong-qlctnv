"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { useCreateFxRate, useGetFxRates, useUpdateFxRate, type FxRate } from "@/lib/api-client";
import { useAuthSession } from "@/components/auth-session-provider";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const LIMIT = 20;

type FormState = {
  fromCurrency: string;
  toCurrency: string;
  rateDate: string;
  rate: string;
  source: string;
};

const DEFAULT_FORM: FormState = {
  fromCurrency: "USD",
  toCurrency: "VND",
  rateDate: "",
  rate: "",
  source: "MANUAL_ADMIN",
};

function toDateInputValue(dateIso: string): string {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export default function FxRatesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { currentUser } = useAuthSession();

  const [q, setQ] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [rateDateFrom, setRateDateFrom] = useState("");
  const [rateDateTo, setRateDateTo] = useState("");
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<FxRate | null>(null);
  const [formState, setFormState] = useState<FormState>(DEFAULT_FORM);
  const [formError, setFormError] = useState<string | null>(null);

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

  const { data, isLoading, error } = useGetFxRates({
    page,
    limit: LIMIT,
    q: q || undefined,
    source: sourceFilter || undefined,
    fromCurrency: "USD",
    toCurrency: "VND",
    rateDateFrom: rateDateFrom || undefined,
    rateDateTo: rateDateTo || undefined,
  });

  const createMutation = useCreateFxRate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/fx-rates"] });
        setDialogOpen(false);
        setEditingRate(null);
        setFormState(DEFAULT_FORM);
        setFormError(null);
      },
      onError: (mutationError) => {
        setFormError(mutationError.message || "Không thể tạo tỷ giá");
      },
    },
  });

  const updateMutation = useUpdateFxRate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/fx-rates"] });
        setDialogOpen(false);
        setEditingRate(null);
        setFormState(DEFAULT_FORM);
        setFormError(null);
      },
      onError: (mutationError) => {
        setFormError(mutationError.message || "Không thể cập nhật tỷ giá");
      },
    },
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const summary = useMemo(() => {
    if (!q && !sourceFilter && !rateDateFrom && !rateDateTo) {
      return "Hiển thị toàn bộ tỷ giá USD/VND đã nhập.";
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

  function openCreateDialog() {
    setEditingRate(null);
    setFormState({ ...DEFAULT_FORM, rateDate: new Date().toISOString().slice(0, 10) });
    setFormError(null);
    setDialogOpen(true);
  }

  function openEditDialog(rate: FxRate) {
    setEditingRate(rate);
    setFormState({
      fromCurrency: rate.fromCurrency,
      toCurrency: rate.toCurrency,
      rateDate: toDateInputValue(rate.rateDate),
      rate: rate.rate,
      source: rate.source,
    });
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSubmitRate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!isFinanceAdmin) {
      setFormError("Bạn không có quyền thao tác tỷ giá.");
      return;
    }

    if (!formState.rateDate || !formState.rate || !formState.source.trim()) {
      setFormError("Vui lòng nhập đầy đủ ngày, tỷ giá và nguồn.");
      return;
    }

    if (editingRate) {
      await updateMutation.mutateAsync({
        id: editingRate.id,
        data: {
          rate: formState.rate,
          source: formState.source,
          rateDate: formState.rateDate,
        },
      });
      return;
    }

    await createMutation.mutateAsync({
      data: {
        fromCurrency: formState.fromCurrency,
        toCurrency: formState.toCurrency,
        rateDate: formState.rateDate,
        rate: formState.rate,
        source: formState.source,
      },
    });
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Quản lý tỷ giá</h1>
        <p className="mt-1 text-muted-foreground">
          Nhập và cập nhật tỷ giá USD/VND theo ngày để phục vụ tự động quy đổi giao dịch.
        </p>
      </div>

      {!isFinanceAdmin ? (
        <Alert>
          <AlertDescription>Chỉ FINANCE_ADMIN mới có quyền tạo và cập nhật tỷ giá.</AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Bộ lọc tỷ giá</CardTitle>
          <CardDescription>{summary}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-5" onSubmit={handleFilterSubmit}>
            <Input name="q" defaultValue={q} placeholder="Tìm theo mã tiền tệ/nguồn" />
            <Input name="source" defaultValue={sourceFilter} placeholder="Nguồn (ví dụ MANUAL_ADMIN)" />
            <Input name="rateDateFrom" defaultValue={rateDateFrom} type="date" />
            <Input name="rateDateTo" defaultValue={rateDateTo} type="date" />
            <Button type="submit">Lọc</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Danh sách tỷ giá USD/VND</CardTitle>
            <CardDescription>
              Trang {page}/{totalPages} • Tổng {total} bản ghi
            </CardDescription>
          </div>
          <Button onClick={openCreateDialog} disabled={!isFinanceAdmin}>
            Thêm tỷ giá
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <p className="text-sm text-destructive">{error.message}</p> : null}

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
                  <TableHead className="text-right">Thao tác</TableHead>
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
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(rate)} disabled={!isFinanceAdmin}>
                        Sửa
                      </Button>
                    </TableCell>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRate ? "Cập nhật tỷ giá" : "Thêm tỷ giá mới"}</DialogTitle>
            <DialogDescription>
              Nhập tỷ giá USD/VND theo ngày để hệ thống dùng cho quy đổi giao dịch ngoại tệ.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmitRate}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="fromCurrency">Từ tiền tệ</Label>
                <Input
                  id="fromCurrency"
                  value={formState.fromCurrency}
                  disabled
                  onChange={(event) => setFormState((prev) => ({ ...prev, fromCurrency: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="toCurrency">Sang tiền tệ</Label>
                <Input
                  id="toCurrency"
                  value={formState.toCurrency}
                  disabled
                  onChange={(event) => setFormState((prev) => ({ ...prev, toCurrency: event.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rateDate">Ngày áp dụng</Label>
              <Input
                id="rateDate"
                type="date"
                value={formState.rateDate}
                onChange={(event) => setFormState((prev) => ({ ...prev, rateDate: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rate">Tỷ giá (VND cho 1 USD)</Label>
              <Input
                id="rate"
                placeholder="Ví dụ: 25450.500000"
                value={formState.rate}
                onChange={(event) => setFormState((prev) => ({ ...prev, rate: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="source">Nguồn</Label>
              <Input
                id="source"
                value={formState.source}
                onChange={(event) => setFormState((prev) => ({ ...prev, source: event.target.value.toUpperCase() }))}
              />
            </div>

            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending || !isFinanceAdmin}>
                {createMutation.isPending || updateMutation.isPending
                  ? "Đang lưu..."
                  : editingRate
                    ? "Lưu cập nhật"
                    : "Tạo tỷ giá"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
