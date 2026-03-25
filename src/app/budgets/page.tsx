"use client";

import { useState } from "react";
import { PieChart, Plus, Building2, AlertTriangle } from "lucide-react";
import { useGetDepartments, useCreateDepartment, useGetTransactions } from "@/lib/api-client";
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
  name: z.string().min(2, "Name required"),
  code: z.string().min(2, "Code required").toUpperCase(),
  budgetAllocated: z.coerce.number().positive("Must be > 0"),
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
  const queryClient = useQueryClient();

  const { data: departments, isLoading: isLoadingDepts } = useGetDepartments();
  const { data: txsData, isLoading: isLoadingTxs } = useGetTransactions({ limit: 1000 });

  const createMutation = useCreateDepartment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
        toast({ title: "Department Created" });
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
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);

  const spentByDept = new Map<number, number>();
  if (txsData?.data) {
    txsData.data.forEach((tx) => {
      if (tx.departmentId && tx.type === "EXPENSE" && tx.status !== "REJECTED") {
        const current = spentByDept.get(tx.departmentId) || 0;
        spentByDept.set(tx.departmentId, current + tx.amount);
      }
    });
  }

  const isLoading = isLoadingDepts || isLoadingTxs;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Department Budgets</h1>
          <p className="text-muted-foreground mt-1">Monitor budget allocation and utilization.</p>
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-md hover:shadow-lg transition-all">
              <Plus className="w-4 h-4" /> Add Department
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Department</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Department Name</Label>
                <Input placeholder="Engineering" {...form.register("name")} />
              </div>
              <div className="space-y-2">
                <Label>Department Code</Label>
                <Input placeholder="ENG" {...form.register("code")} />
              </div>
              <div className="space-y-2">
                <Label>Allocated Budget ($)</Label>
                <Input type="number" {...form.register("budgetAllocated")} />
              </div>
              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Saving..." : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
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
            const spent = spentByDept.get(dept.id) || 0;
            const remaining = dept.budgetAllocated - spent;
            const percentage = Math.min(100, Math.max(0, (spent / dept.budgetAllocated) * 100));
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
                      <span className="text-muted-foreground">Total Budget</span>
                      <span className="font-semibold">{formatCurrency(dept.budgetAllocated)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Spent</span>
                      <span className={`font-semibold ${isOverBudget ? "text-destructive" : ""}`}>{formatCurrency(spent)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className={isOverBudget ? "text-destructive" : isWarning ? "text-yellow-600" : "text-muted-foreground"}>
                        {percentage.toFixed(1)}% utilized
                      </span>
                      <span className="text-muted-foreground">{formatCurrency(remaining)} left</span>
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
          <h3 className="text-lg font-medium text-foreground mb-1">No departments defined</h3>
          <p className="text-muted-foreground mb-4">Create your first department to start tracking budgets.</p>
          <Button onClick={() => setIsModalOpen(true)}>Add Department</Button>
        </div>
      )}
    </div>
  );
}
