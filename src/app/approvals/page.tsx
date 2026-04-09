"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Banknote, Ban, Loader2 } from "lucide-react";
import {
  useGetApprovals,
  useApprovalAction,
  type ApprovalItem,
  type ApprovalStatus,
} from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthSession } from "@/components/auth-session-provider";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatVnd, getTransactionStatusBadgeClass, getTransactionStatusLabel } from "@/lib/ui-labels";

// --- Status helpers ---

const STATUS_CONFIG: Record<
  ApprovalStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING: { label: "Chờ duyệt", variant: "secondary" },
  APPROVED: { label: "Đã duyệt", variant: "default" },
  REJECTED: { label: "Từ chối", variant: "destructive" },
};

function StatusBadge({ status }: { status: ApprovalStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function formatCurrency(value: string | number) {
  const num = typeof value === "string" ? Number.parseFloat(value) : value;
  return formatVnd(num);
}

// --- Action buttons per row ---

function ActionButtons({
  item,
  isManager,
  isAccountant,
  onAction,
}: {
  item: ApprovalItem;
  isManager: boolean;
  isAccountant: boolean;
  onAction: (item: ApprovalItem, action: "approve" | "reject" | "execute" | "not-execute") => void;
}) {
  if (isManager && item.status === "PENDING") {
    return (
      <div className="flex gap-1 justify-end">
        <Button size="sm" variant="default" className="gap-1 h-7 text-xs" onClick={() => onAction(item, "approve")}>
          <CheckCircle2 className="w-3 h-3" /> Duyệt
        </Button>
        <Button size="sm" variant="destructive" className="gap-1 h-7 text-xs" onClick={() => onAction(item, "reject")}>
          <XCircle className="w-3 h-3" /> Từ chối
        </Button>
      </div>
    );
  }
  if (isAccountant && item.status === "APPROVED" && item.transactionStatus === "APPROVED") {
    return (
      <div className="flex gap-1 justify-end">
        <Button size="sm" className="gap-1 h-7 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => onAction(item, "execute")}>
          <Banknote className="w-3 h-3" /> Chi
        </Button>
        <Button size="sm" variant="destructive" className="gap-1 h-7 text-xs" onClick={() => onAction(item, "not-execute")}>
          <Ban className="w-3 h-3" /> Không chi
        </Button>
      </div>
    );
  }
  return null;
}

// --- Main page ---

export default function ApprovalsPage() {
  const { currentUser } = useAuthSession();
  const [tab, setTab] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const statusFilter = tab === "all" ? undefined : (tab.toUpperCase() as ApprovalStatus);
  const { data: approvals, isLoading } = useGetApprovals(
    { status: statusFilter },
    { enabled: !!currentUser },
  );
  const [actionDialog, setActionDialog] = useState<{
    item: ApprovalItem;
    action: "approve" | "reject" | "execute" | "not-execute";
  } | null>(null);
  const [note, setNote] = useState("");
  const [searchText, setSearchText] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();

  const actionMutation = useApprovalAction({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/approvals"] });
        qc.invalidateQueries({ queryKey: ["/api/transactions"] });
        qc.invalidateQueries({ queryKey: ["/api/dashboard/kpis"] });
        qc.invalidateQueries({ queryKey: ["/api/dashboard/expenses-by-month"] });
        toast({ title: "Thành công", description: "Đã cập nhật trạng thái phiếu." });
        setActionDialog(null);
        setNote("");
      },
      onError: (err: Error) => {
        toast({ title: "Lỗi", description: err.message, variant: "destructive" });
      },
    },
  });

  if (
    !currentUser ||
    (currentUser.role !== "MANAGER" &&
      currentUser.role !== "ACCOUNTANT" &&
      currentUser.role !== "FINANCE_ADMIN" &&
      currentUser.role !== "AUDITOR")
  ) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center text-muted-foreground">
          Bạn không có quyền truy cập trang này.
        </Card>
      </div>
    );
  }

  const isManager = currentUser.role === "MANAGER";
  const isAccountant = currentUser.role === "ACCOUNTANT";
  const isReadOnly = currentUser.role === "FINANCE_ADMIN" || currentUser.role === "AUDITOR";

  function handleOpenAction(item: ApprovalItem, action: "approve" | "reject" | "execute" | "not-execute") {
    setActionDialog({ item, action });
    setNote("");
  }

  function handleConfirmAction() {
    if (!actionDialog) return;

    const payload =
      actionDialog.action === "reject"
        ? { action: actionDialog.action, reason: note || undefined }
        : { action: actionDialog.action, note: note || undefined };

    actionMutation.mutate({
      id: actionDialog.item.id,
      data: payload,
    });
  }

  const actionLabels: Record<string, string> = {
    approve: "Duyệt",
    reject: "Không duyệt",
    execute: "Chi",
    "not-execute": "Không chi",
  };

  const keyword = searchText.trim().toLowerCase();
  const filteredApprovals = !keyword
    ? (approvals ?? [])
    : (approvals ?? []).filter((item) => {
        return (
          item.transactionCode.toLowerCase().includes(keyword) ||
          (item.transactionDescription ?? "").toLowerCase().includes(keyword) ||
          item.transactionAmount.toLowerCase().includes(keyword) ||
          (item.approver?.fullName ?? "").toLowerCase().includes(keyword)
        );
      });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Quy trình Duyệt chi
        </h1>
        <p className="text-muted-foreground mt-1">
          Phiếu cần xử lý và lịch sử phiếu đã duyệt
        </p>
      </div>

      {isReadOnly ? (
        <Card className="p-3 text-sm text-muted-foreground">Bạn đang ở chế độ chỉ xem (không thực hiện thao tác duyệt/chi).</Card>
      ) : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="all">Tất cả</TabsTrigger>
          <TabsTrigger value="pending">Chờ duyệt</TabsTrigger>
          <TabsTrigger value="approved">Đã duyệt</TabsTrigger>
          <TabsTrigger value="rejected">Từ chối</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <div className="mb-3">
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Tìm theo mã giao dịch / diễn giải / số tiền"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredApprovals.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              Không có phiếu nào.
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã GD</TableHead>
                    <TableHead>Diễn giải</TableHead>
                    <TableHead className="text-right">Số tiền</TableHead>
                    <TableHead>Trạng thái sếp duyệt</TableHead>
                    <TableHead>Trạng thái kế toán chi</TableHead>
                    <TableHead>Người duyệt</TableHead>
                    <TableHead>Ngày tạo</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApprovals.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.transactionCode}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {item.transactionDescription || "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.transactionAmount)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={item.status} />
                      </TableCell>
                      <TableCell>
                        {item.transactionStatus === "EXECUTED" ? (
                          <Badge variant="outline" className={getTransactionStatusBadgeClass("EXECUTED")}>
                            Đã chi (EXECUTED)
                          </Badge>
                        ) : item.transactionStatus === "REJECTED" ? (
                          <Badge variant="outline" className={getTransactionStatusBadgeClass("REJECTED")}>
                            Không chi (NOT_EXECUTED)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className={getTransactionStatusBadgeClass("PENDING")}>
                            Chờ xử lý
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{item.approver?.fullName ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(item.createdAt), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-right">
                        <ActionButtons
                          item={item}
                          isManager={isManager}
                          isAccountant={isAccountant}
                          onAction={handleOpenAction}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Action confirmation dialog */}
      <Dialog open={!!actionDialog} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionDialog && actionLabels[actionDialog.action]} phiếu{" "}
              {actionDialog?.item.transactionCode}
            </DialogTitle>
            <DialogDescription>
              Số tiền: {actionDialog && formatCurrency(actionDialog.item.transactionAmount)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {actionDialog?.action === "reject" ? "Lý do không duyệt" : "Ghi chú"}
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={actionDialog?.action === "reject" ? "Nhập lý do không duyệt..." : "Nhập ghi chú (không bắt buộc)..."}
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Hủy
            </Button>
            <Button
              onClick={handleConfirmAction}
              disabled={actionMutation.isPending}
              variant={
                actionDialog?.action === "reject" || actionDialog?.action === "not-execute"
                  ? "destructive"
                  : "default"
              }
            >
              {actionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {actionDialog && actionLabels[actionDialog.action]}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
