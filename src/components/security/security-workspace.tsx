"use client";

import { useState } from "react";

import { apiCreateReversal, apiListLedger, apiListLogs } from "@/lib/api";
import type { AuditLogItem, AuthUser, LedgerEntryItem } from "@/lib/api";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getLedgerEntryTypeLabel, getRoleLabel } from "@/lib/ui-labels";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type SecurityWorkspaceProps = {
  token: string | null;
  currentUser: AuthUser | null;
};

function generateIdempotencyKey(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function SecurityWorkspace({ token, currentUser }: SecurityWorkspaceProps) {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const role = currentUser?.role;
  const canViewLogs = role === "FINANCE_ADMIN" || role === "AUDITOR";
  const canViewLedger = role === "FINANCE_ADMIN" || role === "ACCOUNTANT" || role === "AUDITOR";
  const canCreateReversal = role === "FINANCE_ADMIN" || role === "ACCOUNTANT";

  const [logFilter, setLogFilter] = useState({
    entityType: "",
    entityId: "",
    userId: "",
    fromDate: "",
    toDate: "",
  });

  const [ledgerFilter, setLedgerFilter] = useState({
    referenceType: "",
    referenceId: "",
    reversalTargetId: "",
    reversalReason: "",
  });

  async function reloadAllData() {
    if (!token) return;

    setLoading(true);
    setError(null);

    const errors: string[] = [];

    try {
      if (canViewLogs) {
        try {
          const logsPayload = await apiListLogs(token);
          setLogs(logsPayload.logs);
        } catch (unknownError) {
          const message =
            typeof unknownError === "object" && unknownError && "message" in unknownError
              ? String((unknownError as { message: unknown }).message)
              : "Không tải được nhật ký kiểm toán";
          errors.push(message);
          setLogs([]);
        }
      } else {
        setLogs([]);
      }

      if (canViewLedger) {
        try {
          const ledgerPayload = await apiListLedger(token);
          setLedgerEntries(ledgerPayload.entries);
        } catch (unknownError) {
          const message =
            typeof unknownError === "object" && unknownError && "message" in unknownError
              ? String((unknownError as { message: unknown }).message)
              : "Không tải được sổ cái";
          errors.push(message);
          setLedgerEntries([]);
        }
      } else {
        setLedgerEntries([]);
      }

      if (errors.length > 0) {
        setError(errors.join(" • "));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleFilterLogs(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !canViewLogs) return;

    setError(null);

    try {
      const payload = await apiListLogs(token, {
        entityType: logFilter.entityType || undefined,
        entityId: logFilter.entityId || undefined,
        userId: logFilter.userId || undefined,
        fromDate: logFilter.fromDate || undefined,
        toDate: logFilter.toDate || undefined,
      });

      setLogs(payload.logs);
      setFilterOpen(false);
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Lọc nhật ký thất bại";
      setError(message);
    }
  }

  async function handleFilterLedger(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !canViewLedger) return;

    setError(null);

    try {
      const payload = await apiListLedger(token, {
        referenceType: ledgerFilter.referenceType || undefined,
        referenceId: ledgerFilter.referenceId || undefined,
      });

      setLedgerEntries(payload.entries);
      setFilterOpen(false);
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Lọc sổ cái thất bại";
      setError(message);
    }
  }

  async function handleCreateReversal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !canCreateReversal || !ledgerFilter.reversalTargetId || !ledgerFilter.reversalReason) return;

    setError(null);

    try {
      await apiCreateReversal(
        token,
        ledgerFilter.reversalTargetId,
        ledgerFilter.reversalReason,
        generateIdempotencyKey("ledger-reversal"),
      );

      setLedgerFilter((prev) => ({ ...prev, reversalTargetId: "", reversalReason: "" }));
      await reloadAllData();
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Tạo bút toán đảo thất bại";
      setError(message);
    }
  }

  return (
    <section className="space-y-6">
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Tổng quan bảo mật</CardTitle>
          <CardDescription>Theo dõi nhật ký kiểm toán và sổ cái bất biến.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Vai trò hiện tại:</span>
            <Badge variant="outline">{getRoleLabel(currentUser?.role)}</Badge>
          </div>

          {!token ? (
            <Alert>
              <AlertDescription>Vui lòng đăng nhập để sử dụng mô-đun bảo mật.</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={reloadAllData} disabled={!token || loading}>
              {loading ? "Đang tải..." : "Tải dữ liệu bảo mật"}
            </Button>
            <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline">Bộ lọc</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Bộ lọc nhật ký & sổ cái</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <Card className="border-border/50 shadow-sm">
                    <CardHeader>
                      <CardTitle>Nhật ký kiểm toán</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form className="space-y-4" onSubmit={handleFilterLogs}>
                        <div className="space-y-2">
                          <Label htmlFor="log-entity-type">Loại đối tượng</Label>
                          <Input
                            id="log-entity-type"
                            value={logFilter.entityType}
                            onChange={(event) => setLogFilter((prev) => ({ ...prev, entityType: event.target.value }))}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="log-entity-id">ID đối tượng</Label>
                          <Input
                            id="log-entity-id"
                            value={logFilter.entityId}
                            onChange={(event) => setLogFilter((prev) => ({ ...prev, entityId: event.target.value }))}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="log-user-id">ID người dùng</Label>
                          <Input
                            id="log-user-id"
                            value={logFilter.userId}
                            onChange={(event) => setLogFilter((prev) => ({ ...prev, userId: event.target.value }))}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="log-from-date">Từ ngày (ISO)</Label>
                          <Input
                            id="log-from-date"
                            value={logFilter.fromDate}
                            onChange={(event) => setLogFilter((prev) => ({ ...prev, fromDate: event.target.value }))}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="log-to-date">Đến ngày (ISO)</Label>
                          <Input
                            id="log-to-date"
                            value={logFilter.toDate}
                            onChange={(event) => setLogFilter((prev) => ({ ...prev, toDate: event.target.value }))}
                          />
                        </div>

                        <Button type="submit" disabled={!token || !canViewLogs}>
                          Lọc nhật ký
                        </Button>
                      </form>
                    </CardContent>
                  </Card>

                  <Card className="border-border/50 shadow-sm">
                    <CardHeader>
                      <CardTitle>Bộ lọc sổ cái</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form className="space-y-4" onSubmit={handleFilterLedger}>
                        <div className="space-y-2">
                          <Label htmlFor="ledger-reference-type">Loại tham chiếu</Label>
                          <Input
                            id="ledger-reference-type"
                            value={ledgerFilter.referenceType}
                            onChange={(event) => setLedgerFilter((prev) => ({ ...prev, referenceType: event.target.value }))}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="ledger-reference-id">ID tham chiếu</Label>
                          <Input
                            id="ledger-reference-id"
                            value={ledgerFilter.referenceId}
                            onChange={(event) => setLedgerFilter((prev) => ({ ...prev, referenceId: event.target.value }))}
                          />
                        </div>

                        <Button type="submit" disabled={!token || !canViewLedger}>
                          Lọc sổ cái
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>


      {canViewLogs ? (
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Kết quả nhật ký kiểm toán</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Hành động</TableHead>
                  <TableHead>Đối tượng</TableHead>
                  <TableHead>Kết quả</TableHead>
                  <TableHead>Người thực hiện</TableHead>
                  <TableHead>Mã tương quan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{log.createdAt}</TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell>
                      {log.entityType}:{log.entityId}
                    </TableCell>
                    <TableCell>{log.result}</TableCell>
                    <TableCell>{log.actor.username}</TableCell>
                    <TableCell>{log.correlationId ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {canViewLedger ? (
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Sổ cái (bất biến) & bút toán đảo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {canCreateReversal ? (
              <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleCreateReversal}>
                <div className="space-y-2">
                  <Label htmlFor="reversal-target-id">ID bút toán sổ cái cần đảo</Label>
                  <Input
                    id="reversal-target-id"
                    value={ledgerFilter.reversalTargetId}
                    onChange={(event) => setLedgerFilter((prev) => ({ ...prev, reversalTargetId: event.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reversal-reason">Lý do đảo bút toán</Label>
                  <Input
                    id="reversal-reason"
                    value={ledgerFilter.reversalReason}
                    onChange={(event) => setLedgerFilter((prev) => ({ ...prev, reversalReason: event.target.value }))}
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <Button type="submit" disabled={!token || !canCreateReversal}>
                    Tạo bút toán đảo
                  </Button>
                </div>
              </form>
            ) : null}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã bút toán</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Số tiền</TableHead>
                  <TableHead>Tham chiếu</TableHead>
                  <TableHead>Đảo của</TableHead>
                  <TableHead>Người tạo</TableHead>
                  <TableHead>Thời điểm tạo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.entryCode}</TableCell>
                    <TableCell>{getLedgerEntryTypeLabel(entry.type)}</TableCell>
                    <TableCell>
                      {entry.amount} {entry.currency}
                    </TableCell>
                    <TableCell>
                      {entry.referenceType}:{entry.referenceId}
                    </TableCell>
                    <TableCell>{entry.reversalOfEntryCode ?? entry.reversalOfId ?? "-"}</TableCell>
                    <TableCell>{entry.createdBy.username}</TableCell>
                    <TableCell>{entry.createdAt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
