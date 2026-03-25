"use client";

import { useMemo, useState } from "react";

import {
  apiBudgetStatus,
  apiConfigureHardStop,
  apiCreateBudget,
  apiListBudgets,
  apiTransferBudget,
  apiUpdateBudget,
} from "@/lib/api";
import type { BudgetItem, BudgetStatus } from "@/lib/api";

const DEFAULT_WARNING = 80;

type BudgetingWorkspaceProps = {
  token: string | null;
};

function generateIdempotencyKey(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function BudgetingWorkspace({ token }: BudgetingWorkspaceProps) {
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [statusByBudget, setStatusByBudget] = useState<Record<string, BudgetStatus>>({});
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [createForm, setCreateForm] = useState({
    departmentId: "",
    period: "",
    amount: "",
    parentBudgetId: "",
  });

  const [updateForm, setUpdateForm] = useState({
    amount: "",
    parentBudgetId: "",
  });

  const [transferForm, setTransferForm] = useState({
    toBudgetId: "",
    amount: "",
    reason: "",
  });

  const [policyForm, setPolicyForm] = useState({
    budgetId: "",
    enabled: true,
    warningThresholdPct: DEFAULT_WARNING,
  });

  const selectedStatus = useMemo(() => {
    if (!selectedBudgetId) return null;
    return statusByBudget[selectedBudgetId] ?? null;
  }, [selectedBudgetId, statusByBudget]);

  async function refreshBudgets() {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const payload = await apiListBudgets(token);
      setBudgets(payload.budgets);

      const statuses = await Promise.all(payload.budgets.map((budget) => apiBudgetStatus(token, budget.id)));

      setStatusByBudget(
        statuses.reduce<Record<string, BudgetStatus>>((accumulator, status) => {
          accumulator[status.budgetId] = status;
          return accumulator;
        }, {}),
      );
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Không tải được dữ liệu ngân sách";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateBudget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setError(null);

    try {
      await apiCreateBudget(token, {
        departmentId: createForm.departmentId,
        period: createForm.period,
        amount: createForm.amount,
        parentBudgetId: createForm.parentBudgetId || null,
      });

      setCreateForm({ departmentId: "", period: "", amount: "", parentBudgetId: "" });
      await refreshBudgets();
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Tạo ngân sách thất bại";
      setError(message);
    }
  }

  async function handleUpdateBudget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedBudgetId) return;

    setError(null);

    try {
      await apiUpdateBudget(token, selectedBudgetId, {
        amount: updateForm.amount,
        parentBudgetId: updateForm.parentBudgetId || null,
      });

      setUpdateForm({ amount: "", parentBudgetId: "" });
      await refreshBudgets();
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Cập nhật ngân sách thất bại";
      setError(message);
    }
  }

  async function handleTransferBudget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedBudgetId) return;

    setError(null);

    try {
      await apiTransferBudget(
        token,
        selectedBudgetId,
        {
          toBudgetId: transferForm.toBudgetId,
          amount: transferForm.amount,
          reason: transferForm.reason,
        },
        generateIdempotencyKey("budget-transfer"),
      );

      setTransferForm({ toBudgetId: "", amount: "", reason: "" });
      await refreshBudgets();
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Chuyển ngân sách thất bại";
      setError(message);
    }
  }

  async function handleConfigurePolicy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setError(null);

    try {
      await apiConfigureHardStop(token, {
        budgetId: policyForm.budgetId || null,
        enabled: policyForm.enabled,
        warningThresholdPct: policyForm.warningThresholdPct,
      });
      await refreshBudgets();
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Cấu hình policy thất bại";
      setError(message);
    }
  }

  const isHardStop = selectedStatus?.hardStopEnabled && selectedStatus.available === "0.00";

  return (
    <section className="panel">
      <h2>Budgeting & Budget Control</h2>

      {!token ? <p>Vui lòng đăng nhập để thao tác ngân sách.</p> : null}

      <div className="toolbar">
        <button type="button" onClick={refreshBudgets} disabled={!token || loading}>
          {loading ? "Đang tải..." : "Tải dữ liệu ngân sách"}
        </button>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="grid two-columns">
        <form className="panel form-grid" onSubmit={handleCreateBudget}>
          <h3>Tạo ngân sách</h3>
          <label>
            Department ID
            <input
              value={createForm.departmentId}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, departmentId: event.target.value }))}
              required
            />
          </label>
          <label>
            Kỳ ngân sách (period)
            <input
              value={createForm.period}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, period: event.target.value }))}
              required
            />
          </label>
          <label>
            Amount
            <input
              value={createForm.amount}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, amount: event.target.value }))}
              placeholder="100000000.00"
              required
            />
          </label>
          <label>
            Parent Budget ID (optional)
            <input
              value={createForm.parentBudgetId}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, parentBudgetId: event.target.value }))}
            />
          </label>
          <button type="submit" disabled={!token}>
            Tạo ngân sách
          </button>
        </form>

        <form className="panel form-grid" onSubmit={handleConfigurePolicy}>
          <h3>Budget Control Policy</h3>
          <label>
            Budget ID (trống = global)
            <input
              value={policyForm.budgetId}
              onChange={(event) => setPolicyForm((prev) => ({ ...prev, budgetId: event.target.value }))}
            />
          </label>

          <label className="inline">
            <input
              type="checkbox"
              checked={policyForm.enabled}
              onChange={(event) => setPolicyForm((prev) => ({ ...prev, enabled: event.target.checked }))}
            />
            Hard Stop Enabled
          </label>

          <label>
            Warning Threshold (%)
            <input
              type="number"
              min={1}
              max={100}
              value={policyForm.warningThresholdPct}
              onChange={(event) =>
                setPolicyForm((prev) => ({
                  ...prev,
                  warningThresholdPct: Number(event.target.value || DEFAULT_WARNING),
                }))
              }
            />
          </label>

          <button type="submit" disabled={!token}>
            Lưu policy
          </button>
        </form>
      </div>

      <div className="panel">
        <h3>Danh sách ngân sách</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Department</th>
                <th>Period</th>
                <th>Amount</th>
                <th>Reserved</th>
                <th>Used</th>
                <th>Available</th>
                <th>Usage%</th>
                <th>Warning</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((budget) => {
                const status = statusByBudget[budget.id];
                const isSelected = selectedBudgetId === budget.id;

                return (
                  <tr
                    key={budget.id}
                    className={isSelected ? "row-selected" : undefined}
                    onClick={() => {
                      setSelectedBudgetId(budget.id);
                      setUpdateForm({ amount: budget.amount, parentBudgetId: budget.parentBudgetId ?? "" });
                    }}
                  >
                    <td>{budget.id}</td>
                    <td>{budget.departmentId}</td>
                    <td>{budget.period}</td>
                    <td>{budget.amount}</td>
                    <td>{budget.reserved}</td>
                    <td>{budget.used}</td>
                    <td>{budget.available}</td>
                    <td>{status ? `${status.percentageUsed}%` : "-"}</td>
                    <td>{status?.warning ? "Cảnh báo" : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedBudgetId ? (
        <div className="grid two-columns">
          <form className="panel form-grid" onSubmit={handleUpdateBudget}>
            <h3>Cập nhật ngân sách: {selectedBudgetId}</h3>
            <label>
              Amount mới
              <input
                value={updateForm.amount}
                onChange={(event) => setUpdateForm((prev) => ({ ...prev, amount: event.target.value }))}
                required
              />
            </label>
            <label>
              Parent Budget ID
              <input
                value={updateForm.parentBudgetId}
                onChange={(event) => setUpdateForm((prev) => ({ ...prev, parentBudgetId: event.target.value }))}
              />
            </label>
            <button type="submit" disabled={!token}>
              Cập nhật
            </button>
          </form>

          <form className="panel form-grid" onSubmit={handleTransferBudget}>
            <h3>Chuyển ngân sách</h3>
            <label>
              To Budget ID
              <input
                value={transferForm.toBudgetId}
                onChange={(event) => setTransferForm((prev) => ({ ...prev, toBudgetId: event.target.value }))}
                required
                disabled={!token || Boolean(isHardStop)}
              />
            </label>
            <label>
              Amount
              <input
                value={transferForm.amount}
                onChange={(event) => setTransferForm((prev) => ({ ...prev, amount: event.target.value }))}
                required
                disabled={!token || Boolean(isHardStop)}
              />
            </label>
            <label>
              Reason
              <input
                value={transferForm.reason}
                onChange={(event) => setTransferForm((prev) => ({ ...prev, reason: event.target.value }))}
                disabled={!token || Boolean(isHardStop)}
              />
            </label>

            {selectedStatus?.warning ? (
              <p className="warning-text">
                Ngân sách đã sử dụng {selectedStatus.percentageUsed}% ({">="} {selectedStatus.warningThresholdPct}%).
              </p>
            ) : null}

            {isHardStop ? (
              <p className="error-text">Hard Stop: available = 0.00, hệ thống khóa thao tác chi/chuyển ra.</p>
            ) : null}

            <button type="submit" disabled={!token || Boolean(isHardStop)}>
              Chuyển ngân sách
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
