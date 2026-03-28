import { NextResponse } from "next/server";
import { getStore } from "../../_store";

// GET /api/budgets/available?departmentId=1&period=2026-03
// Trả về ngân sách khả dụng = amount - reserved - used
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get("departmentId");
  const period = searchParams.get("period");

  if (!departmentId) {
    return NextResponse.json(
      { error: "Missing departmentId" },
      { status: 400 },
    );
  }

  const store = getStore();
  const deptId = Number(departmentId);

  // Tìm budget record cho department + period
  const budget = store.budgets.find(
    (b) => b.departmentId === deptId && (!period || b.period === period),
  );

  if (!budget) {
    // Nếu không có budget record, lấy từ department.budgetAllocated
    const dept = store.departments.find((d) => d.id === deptId);
    if (!dept) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      departmentId: deptId,
      period: period || "N/A",
      amount: dept.budgetAllocated,
      reserved: 0,
      used: 0,
      available: dept.budgetAllocated,
    });
  }

  const available = budget.amount - budget.reserved - budget.used;

  return NextResponse.json({
    departmentId: budget.departmentId,
    period: budget.period,
    amount: budget.amount,
    reserved: budget.reserved,
    used: budget.used,
    available,
  });
}
