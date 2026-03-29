"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  useCreateReimbursement,
  useGetReimbursements,
  useReimbursementAction,
  type ReimbursementItem,
  type ReimbursementStatus,
} from "@/lib/api-client";
import { useAuthSession } from "@/components/auth-session-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type TabKey = "mine" | "pending-approval" | "advance-paid" | "settlement-submitted" | "history";

type ActionKind = "approve" | "reject" | "pay-advance" | "submit-settlement" | "review-settlement" | "complete";

const STATUS_LABEL: Record<ReimbursementStatus, string> = {
  PENDING_APPROVAL: "Chờ duyệt tạm ứng",
  ADVANCE_APPROVED: "Đã duyệt tạm ứng",
  ADVANCE_PAID: "Đã chi tạm ứng",
  SETTLEMENT_SUBMITTED: "Đã nộp quyết toán",
  SETTLEMENT_REVIEWED: "Đã review quyết toán",
  COMPLETED: "Hoàn tất",
  REJECTED: "Từ chối",
};

function getDirectionLabel(item: ReimbursementItem) {
  if (!item.settlementDirection || !item.netAmount) return "-";
  const abs = item.netAmount.startsWith("-") ? item.netAmount.slice(1) : item.netAmount;
  if (item.settlementDirection === "RETURN_TO_COMPANY") {
    return `Trả lại công ty ${Number(abs).toLocaleString("vi-VN")} VND`;
  }
  if (item.settlementDirection === "PAY_TO_EMPLOYEE") {
    return `Công ty trả thêm ${Number(abs).toLocaleString("vi-VN")} VND`;
  }
  return "Không phát sinh bù trừ";
}

export default function ReimbursementPage() {
  const { currentUser } = useAuthSession();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [tab, setTab] = useState<TabKey>("mine");

  const [createOpen, setCreateOpen] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");

  const [actionDialog, setActionDialog] = useState<{ item: ReimbursementItem; action: ActionKind } | null>(null);
  const [note, setNote] = useState("");
  const [actualAmount, setActualAmount] = useState("");
  const [reason, setReason] = useState("");

  const statusFilter = useMemo<ReimbursementStatus | undefined>(() => {
    if (tab === "pending-approval") return "PENDING_APPROVAL";
    if (tab === "advance-paid") return "ADVANCE_PAID";
    if (tab === "settlement-submitted") return "SETTLEMENT_SUBMITTED";
    if (tab === "history") return undefined;
    return undefined;
  }, [tab]);

  const mine = tab === "mine";

  const { data, isLoading } = useGetReimbursements({ page: 1, limit: 100, status: statusFilter, mine }, { enabled: !!currentUser });

  const createMutation = useCreateReimbursement({
    mutation: {
      onSuccess: () => {
        toast({ title: "Thành công", description: "Đã tạo đề nghị tạm ứng." });
        setCreateOpen(false);
        setPurpose("");
        setAdvanceAmount("");
        qc.invalidateQueries({ queryKey: ["/api/reimbursements"] });
      },
      onError: (err: Error) => {
        toast({ title: "Lỗi", description: err.message, variant: "destructive" });
      },
    },
  });

  const actionMutation = useReimbursementAction({
    mutation: {
      onSuccess: () => {
        toast({ title: "Thành công", description: "Đã cập nhật trạng thái hoàn ứng." });
        setActionDialog(null);
        setNote("");
        setActualAmount("");
        setReason("");
        qc.invalidateQueries({ queryKey: ["/api/reimbursements"] });
      },
      onError: (err: Error) => {
        toast({ title: "Lỗi", description: err.message, variant: "destructive" });
      },
    },
  });

  const isManager = currentUser?.role === "MANAGER" || currentUser?.role === "FINANCE_ADMIN";
  const isAccountant = currentUser?.role === "ACCOUNTANT" || currentUser?.role === "FINANCE_ADMIN";
  const isEmployee = currentUser?.role === "EMPLOYEE" || currentUser?.role === "FINANCE_ADMIN";

  const rows = data?.reimbursements ?? [];

  function openAction(item: ReimbursementItem, action: ActionKind) {
    setActionDialog({ item, action });
    setNote("");
    setActualAmount("");
    setReason("");
  }

  function canAct(item: ReimbursementItem, action: ActionKind) {
    if (action === "approve") return isManager && item.status === "PENDING_APPROVAL";
    if (action === "reject") return (isManager || isAccountant) && item.status !== "COMPLETED" && item.status !== "REJECTED";
    if (action === "pay-advance") return isAccountant && item.status === "ADVANCE_APPROVED";
    if (action === "submit-settlement") return isEmployee && item.status === "ADVANCE_PAID" && item.employeeId === currentUser?.id;
    if (action === "review-settlement") return isAccountant && item.status === "SETTLEMENT_SUBMITTED";
    if (action === "complete") return isAccountant && item.status === "SETTLEMENT_REVIEWED";
    return false;
  }

  function onCreate() {
    createMutation.mutate({
      data: {
        purpose,
        advanceAmount,
      },
    });
  }

  function onConfirmAction() {
    if (!actionDialog) return;

    const { item, action } = actionDialog;

    if (action === "approve") {
      actionMutation.mutate({ id: item.id, action: "approve", data: { note } });
      return;
    }
    if (action === "reject") {
      actionMutation.mutate({ id: item.id, action: "reject", data: { reason } });
      return;
    }
    if (action === "pay-advance") {
      actionMutation.mutate({ id: item.id, action: "pay-advance", data: { note } });
      return;
    }
    if (action === "submit-settlement") {
      actionMutation.mutate({
        id: item.id,
        action: "submit-settlement",
        data: {
          actualAmount,
          settlementNote: note,
          attachments: [],
        },
      });
      return;
    }
    if (action === "review-settlement") {
      actionMutation.mutate({ id: item.id, action: "review-settlement", data: { note } });
      return;
    }

    actionMutation.mutate({ id: item.id, action: "complete", data: {} });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hoàn ứng công tác</h1>
          <p className="text-muted-foreground mt-1">Quy trình tạm ứng, quyết toán và bù trừ tự động.</p>
        </div>
        {isEmployee ? (
          <Button onClick={() => setCreateOpen(true)}>Tạo đề nghị tạm ứng</Button>
        ) : null}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="mine">Của tôi</TabsTrigger>
          <TabsTrigger value="pending-approval">Chờ duyệt tạm ứng</TabsTrigger>
          <TabsTrigger value="advance-paid">Chờ nộp quyết toán</TabsTrigger>
          <TabsTrigger value="settlement-submitted">Chờ review quyết toán</TabsTrigger>
          <TabsTrigger value="history">Lịch sử</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <Card className="p-8 text-center text-muted-foreground">Đang tải dữ liệu...</Card>
          ) : rows.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">Không có hồ sơ hoàn ứng nào.</Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã</TableHead>
                    <TableHead>Nhân viên</TableHead>
                    <TableHead>Mục đích</TableHead>
                    <TableHead className="text-right">Tạm ứng</TableHead>
                    <TableHead className="text-right">Thực chi</TableHead>
                    <TableHead>Bù trừ</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.id.slice(0, 8)}</TableCell>
                      <TableCell>{item.employee?.fullName ?? item.employeeId}</TableCell>
                      <TableCell>{item.purpose}</TableCell>
                      <TableCell className="text-right">{Number(item.advanceAmount).toLocaleString("vi-VN")}</TableCell>
                      <TableCell className="text-right">{item.actualAmount ? Number(item.actualAmount).toLocaleString("vi-VN") : "-"}</TableCell>
                      <TableCell>{getDirectionLabel(item)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{STATUS_LABEL[item.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          {canAct(item, "approve") ? <Button size="sm" onClick={() => openAction(item, "approve")}>Duyệt</Button> : null}
                          {canAct(item, "reject") ? <Button size="sm" variant="destructive" onClick={() => openAction(item, "reject")}>Từ chối</Button> : null}
                          {canAct(item, "pay-advance") ? <Button size="sm" onClick={() => openAction(item, "pay-advance")}>Chi tạm ứng</Button> : null}
                          {canAct(item, "submit-settlement") ? <Button size="sm" onClick={() => openAction(item, "submit-settlement")}>Nộp quyết toán</Button> : null}
                          {canAct(item, "review-settlement") ? <Button size="sm" onClick={() => openAction(item, "review-settlement")}>Review</Button> : null}
                          {canAct(item, "complete") ? <Button size="sm" onClick={() => openAction(item, "complete")}>Hoàn tất</Button> : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo đề nghị tạm ứng</DialogTitle>
            <DialogDescription>Nhập mục đích công tác và số tiền tạm ứng.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Mục đích</label>
              <Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={3} />
            </div>
            <div>
              <label className="text-sm font-medium">Số tiền tạm ứng (VND)</label>
              <Input value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} placeholder="5000000" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button>
            <Button onClick={onCreate} disabled={createMutation.isPending}>Gửi đề nghị</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!actionDialog} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.action === "approve" && "Duyệt tạm ứng"}
              {actionDialog?.action === "reject" && "Từ chối"}
              {actionDialog?.action === "pay-advance" && "Chi tạm ứng"}
              {actionDialog?.action === "submit-settlement" && "Nộp quyết toán"}
              {actionDialog?.action === "review-settlement" && "Review quyết toán"}
              {actionDialog?.action === "complete" && "Hoàn tất hồ sơ"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {actionDialog?.action === "submit-settlement" ? (
              <div>
                <label className="text-sm font-medium">Thực chi (VND)</label>
                <Input value={actualAmount} onChange={(e) => setActualAmount(e.target.value)} placeholder="4000000" />
              </div>
            ) : null}

            {actionDialog?.action === "reject" ? (
              <div>
                <label className="text-sm font-medium">Lý do từ chối</label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium">Ghi chú</label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Hủy</Button>
            <Button onClick={onConfirmAction} disabled={actionMutation.isPending}>Xác nhận</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
