"use client";

import { useState } from "react";
import { PieChart, Plus, Building2, AlertTriangle } from "lucide-react";
import { useGetDepartments, useCreateDepartment, useGetTransactions } from "@/lib/api-client";
import { useAuthSession } from "@/components/auth-session-provider";
import { useQueryClient } from "@tanstack/react-query";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  name: z.string().min(2, "Tên phòng ban là bắt buộc"),
  code: z.string().min(2, "Mã phòng ban là bắt buộc").toUpperCase(),
  budgetAllocated: z.coerce.number().positive("Ngân sách phải lớn hơn 0"),
});

type FormInputValues = z.input<typeof formSchema>;
type FormValues = z.output<typeof formSchema>;

type CreateDepartmentInput = {
  name: string;
  code: string;
  budgetAllocated: number;
};

export default function BudgetsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();
  const { currentUser } = useAuthSession();
  const canCreateDepartment = currentUser?.role === "FINANCE_ADMIN";
  const queryClient = useQueryClient();

  const { data: departments, isLoading: isLoadingDepts } = useGetDepartments();
  const { data: txsData, isLoading: isLoadingTxs } = useGetTransactions({ limit: 1000 });

  const createMutation = useCreateDepartment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
        toast({ title: "Đã tạo phòng ban" });
        setIsModalOpen(false);
        form.reset();
      },
    },
  });

  const form = useForm<FormInputValues, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", code: "", budgetAllocated: 0 },
  });

  const onSubmit: SubmitHandler<FormValues> = (values) => {
    const payload: CreateDepartmentInput = {
      name: values.name,
      code: values.code,
      budgetAllocated: values.budgetAllocated,
    };
    createMutation.mutate({ data: payload });
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(val);

  const spentByDept = new Map<string, number>();
  if (txsData?.data) {
    txsData.data.forEach((tx) => {
      if (tx.departmentId && tx.type === "EXPENSE" && tx.status === "EXECUTED") {
        const amount = Number(tx.amount);
        if (!Number.isFinite(amount)) return;

        const key = String(tx.departmentId);
        const current = spentByDept.get(key) || 0;
        spentByDept.set(key, current + amount);
      }
    });
  }

  const isLoading = isLoadingDepts || isLoadingTxs;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ngân sách phòng ban</h1>
          <p className="text-muted-foreground mt-1">Theo dõi phân bổ và mức sử dụng ngân sách.</p>
        </div>

        {canCreateDepartment ? (
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-md hover:shadow-lg transition-all">
                <Plus className="w-4 h-4" /> Thêm phòng ban
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Thêm phòng ban mới</DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Tên phòng ban</Label>
                  <Input placeholder="Kỹ thuật" {...form.register("name")} />
                </div>
                <div className="space-y-2">
                  <Label>Mã phòng ban</Label>
                  <Input placeholder="KT" {...form.register("code")} />
                </div>
                <div className="space-y-2">
                  <Label>Ngân sách phân bổ (VND)</Label>
                  <Input type="number" {...form.register("budgetAllocated")} />
                </div>
                <div className="pt-4 flex justify-end">
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Đang lưu..." : "Tạo mới"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-border/50 shadow-sm">
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-4" />
                <Skeleton className="h-10 w-full mb-6" />
                <Skeleton className="h-2 w-full mb-2" />
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          departments?.map((dept) => {
            const budgetAllocated = Number(dept.budgetAllocated);
            const safeBudgetAllocated = Number.isFinite(budgetAllocated) ? budgetAllocated : 0;
            const spent = spentByDept.get(String(dept.id)) || 0;
            const remaining = safeBudgetAllocated - spent;
            const percentage = safeBudgetAllocated > 0 ? Math.min(100, Math.max(0, (spent / safeBudgetAllocated) * 100)) : 0;
            const isOverBudget = percentage >= 100;
            const isWarning = percentage >= 85 && percentage < 100;

            return (
              <Card key={dept.id} className="border-border/50 shadow-sm hover-elevate transition-all overflow-hidden relative group">
                {isOverBudget && <div className="absolute top-0 left-0 w-full h-1 bg-destructive" />}
                {!isOverBudget && isWarning && <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500" />}
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-secondary/80 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <Building2 className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg leading-tight">{dept.name}</h3>
                        <span className="text-xs font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{dept.code}</span>
                      </div>
                    </div>
                    {isOverBudget && <AlertTriangle className="w-5 h-5 text-destructive animate-pulse" />}
                  </div>

                  <div className="mb-6 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tổng ngân sách</span>
                      <span className="font-semibold">{formatCurrency(safeBudgetAllocated)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Đã chi</span>
                      <span className={`font-semibold ${isOverBudget ? "text-destructive" : ""}`}>{formatCurrency(spent)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className={isOverBudget ? "text-destructive" : isWarning ? "text-yellow-600" : "text-muted-foreground"}>
                        Đã chi {percentage.toFixed(1)}%
                      </span>
                      <span className="text-muted-foreground">Còn lại {formatCurrency(remaining)}</span>
                    </div>
                    <Progress value={percentage} className="h-2" indicatorClassName={isOverBudget ? "bg-destructive" : isWarning ? "bg-yellow-500" : "bg-primary"} />
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {departments?.length === 0 && !isLoading && (
        <div className="p-6 sm:p-12 text-center border-2 border-dashed border-border/50 rounded-2xl">
          <PieChart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">Chưa có phòng ban nào</h3>
          <p className="text-muted-foreground mb-4">Hãy tạo phòng ban đầu tiên để bắt đầu theo dõi ngân sách.</p>
          {canCreateDepartment ? <Button onClick={() => setIsModalOpen(true)}>Thêm phòng ban</Button> : null}
        </div>
      )}
    </div>
  );
}
