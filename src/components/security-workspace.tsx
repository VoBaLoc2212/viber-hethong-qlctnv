"use client";

import { useState } from "react";

import {
  apiCreateReversal,
  apiDeleteUser,
  apiListLedger,
  apiListLogs,
  apiListUsers,
  apiRegisterUser,
  apiUpdateUser,
} from "@/lib/api";
import type { AuditLogItem, AuthUser, LedgerEntryItem } from "@/lib/api";

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
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [registerForm, setRegisterForm] = useState({
    username: "",
    password: "",
    fullName: "",
    email: "",
    role: "EMPLOYEE" as "EMPLOYEE" | "MANAGER" | "ACCOUNTANT" | "FINANCE_ADMIN" | "AUDITOR",
  });

  const [updateForm, setUpdateForm] = useState({
    id: "",
    username: "",
    fullName: "",
    email: "",
    role: "EMPLOYEE" as "EMPLOYEE" | "MANAGER" | "ACCOUNTANT" | "FINANCE_ADMIN" | "AUDITOR",
    isActive: true,
  });

  const [deleteUserId, setDeleteUserId] = useState("");
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

    try {
      const [usersPayload, logsPayload, ledgerPayload] = await Promise.all([
        apiListUsers(token),
        apiListLogs(token),
        apiListLedger(token),
      ]);

      setUsers(usersPayload.users);
      setLogs(logsPayload.logs);
      setLedgerEntries(ledgerPayload.entries);
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Không tải được dữ liệu security";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setError(null);

    try {
      await apiRegisterUser(token, registerForm);
      setRegisterForm({
        username: "",
        password: "",
        fullName: "",
        email: "",
        role: "EMPLOYEE",
      });
      await reloadAllData();
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Đăng ký user thất bại";
      setError(message);
    }
  }

  async function handleUpdateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !updateForm.id) return;

    setError(null);

    try {
      await apiUpdateUser(token, updateForm.id, {
        username: updateForm.username || undefined,
        fullName: updateForm.fullName || undefined,
        email: updateForm.email || undefined,
        role: updateForm.role,
        isActive: updateForm.isActive,
      });

      await reloadAllData();
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Cập nhật user thất bại";
      setError(message);
    }
  }

  async function handleDeleteUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !deleteUserId) return;

    setError(null);

    try {
      await apiDeleteUser(token, deleteUserId);
      setDeleteUserId("");
      await reloadAllData();
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Xóa user thất bại";
      setError(message);
    }
  }

  async function handleFilterLogs(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

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
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Lọc logs thất bại";
      setError(message);
    }
  }

  async function handleFilterLedger(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setError(null);

    try {
      const payload = await apiListLedger(token, {
        referenceType: ledgerFilter.referenceType || undefined,
        referenceId: ledgerFilter.referenceId || undefined,
      });

      setLedgerEntries(payload.entries);
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Lọc ledger thất bại";
      setError(message);
    }
  }

  async function handleCreateReversal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !ledgerFilter.reversalTargetId || !ledgerFilter.reversalReason) return;

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
          : "Tạo reversal thất bại";
      setError(message);
    }
  }

  return (
    <section className="panel">
      <h2>Security & Logs</h2>
      <p>
        Current role: <strong>{currentUser?.role ?? "N/A"}</strong>
      </p>

      {!token ? <p>Vui lòng đăng nhập để sử dụng module security.</p> : null}

      <div className="toolbar">
        <button type="button" onClick={reloadAllData} disabled={!token || loading}>
          {loading ? "Đang tải..." : "Tải dữ liệu security"}
        </button>
      </div>

      {token && currentUser?.role !== "FINANCE_ADMIN" ? (
        <p className="warning-text">
          Lưu ý: chỉ FINANCE_ADMIN có toàn quyền quản trị user; các thao tác khác phụ thuộc role.
        </p>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      <div className="grid three-columns">
        <form className="panel form-grid" onSubmit={handleRegisterUser}>
          <h3>Register User</h3>
          <label>
            Username
            <input
              value={registerForm.username}
              onChange={(event) => setRegisterForm((prev) => ({ ...prev, username: event.target.value }))}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={registerForm.password}
              onChange={(event) => setRegisterForm((prev) => ({ ...prev, password: event.target.value }))}
              required
            />
          </label>
          <label>
            Full Name
            <input
              value={registerForm.fullName}
              onChange={(event) => setRegisterForm((prev) => ({ ...prev, fullName: event.target.value }))}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={registerForm.email}
              onChange={(event) => setRegisterForm((prev) => ({ ...prev, email: event.target.value }))}
              required
            />
          </label>
          <label>
            Role
            <select
              value={registerForm.role}
              onChange={(event) =>
                setRegisterForm((prev) => ({
                  ...prev,
                  role: event.target.value as
                    | "EMPLOYEE"
                    | "MANAGER"
                    | "ACCOUNTANT"
                    | "FINANCE_ADMIN"
                    | "AUDITOR",
                }))
              }
            >
              <option value="EMPLOYEE">EMPLOYEE</option>
              <option value="MANAGER">MANAGER</option>
              <option value="ACCOUNTANT">ACCOUNTANT</option>
              <option value="FINANCE_ADMIN">FINANCE_ADMIN</option>
              <option value="AUDITOR">AUDITOR</option>
            </select>
          </label>
          <button type="submit" disabled={!token || currentUser?.role !== "FINANCE_ADMIN"}>
            Tạo user
          </button>
        </form>

        <form className="panel form-grid" onSubmit={handleUpdateUser}>
          <h3>Update User</h3>
          <label>
            User ID
            <input
              value={updateForm.id}
              onChange={(event) => setUpdateForm((prev) => ({ ...prev, id: event.target.value }))}
              required
            />
          </label>
          <label>
            Username
            <input
              value={updateForm.username}
              onChange={(event) => setUpdateForm((prev) => ({ ...prev, username: event.target.value }))}
            />
          </label>
          <label>
            Full Name
            <input
              value={updateForm.fullName}
              onChange={(event) => setUpdateForm((prev) => ({ ...prev, fullName: event.target.value }))}
            />
          </label>
          <label>
            Email
            <input
              value={updateForm.email}
              onChange={(event) => setUpdateForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </label>
          <label>
            Role
            <select
              value={updateForm.role}
              onChange={(event) =>
                setUpdateForm((prev) => ({
                  ...prev,
                  role: event.target.value as
                    | "EMPLOYEE"
                    | "MANAGER"
                    | "ACCOUNTANT"
                    | "FINANCE_ADMIN"
                    | "AUDITOR",
                }))
              }
            >
              <option value="EMPLOYEE">EMPLOYEE</option>
              <option value="MANAGER">MANAGER</option>
              <option value="ACCOUNTANT">ACCOUNTANT</option>
              <option value="FINANCE_ADMIN">FINANCE_ADMIN</option>
              <option value="AUDITOR">AUDITOR</option>
            </select>
          </label>
          <label className="inline">
            <input
              type="checkbox"
              checked={updateForm.isActive}
              onChange={(event) => setUpdateForm((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
            Active
          </label>
          <button
            type="submit"
            disabled={!token || (currentUser?.role !== "FINANCE_ADMIN" && updateForm.id !== currentUser?.id)}
          >
            Cập nhật user
          </button>
        </form>

        <form className="panel form-grid" onSubmit={handleDeleteUser}>
          <h3>Delete User</h3>
          <label>
            User ID
            <input value={deleteUserId} onChange={(event) => setDeleteUserId(event.target.value)} required />
          </label>
          <button type="submit" disabled={!token || currentUser?.role !== "FINANCE_ADMIN"}>
            Xóa user
          </button>
        </form>
      </div>

      <div className="panel">
        <h3>Users</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Full Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.username}</td>
                  <td>{user.fullName}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{String(user.isActive)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid two-columns">
        <form className="panel form-grid" onSubmit={handleFilterLogs}>
          <h3>Audit Logs</h3>
          <label>
            Entity Type
            <input
              value={logFilter.entityType}
              onChange={(event) => setLogFilter((prev) => ({ ...prev, entityType: event.target.value }))}
            />
          </label>
          <label>
            Entity ID
            <input
              value={logFilter.entityId}
              onChange={(event) => setLogFilter((prev) => ({ ...prev, entityId: event.target.value }))}
            />
          </label>
          <label>
            User ID
            <input
              value={logFilter.userId}
              onChange={(event) => setLogFilter((prev) => ({ ...prev, userId: event.target.value }))}
            />
          </label>
          <label>
            From Date (ISO)
            <input
              value={logFilter.fromDate}
              onChange={(event) => setLogFilter((prev) => ({ ...prev, fromDate: event.target.value }))}
            />
          </label>
          <label>
            To Date (ISO)
            <input
              value={logFilter.toDate}
              onChange={(event) => setLogFilter((prev) => ({ ...prev, toDate: event.target.value }))}
            />
          </label>
          <button
            type="submit"
            disabled={!token || (currentUser?.role !== "FINANCE_ADMIN" && currentUser?.role !== "AUDITOR")}
          >
            Lọc logs
          </button>
        </form>

        <form className="panel form-grid" onSubmit={handleFilterLedger}>
          <h3>Ledger Filter</h3>
          <label>
            Reference Type
            <input
              value={ledgerFilter.referenceType}
              onChange={(event) => setLedgerFilter((prev) => ({ ...prev, referenceType: event.target.value }))}
            />
          </label>
          <label>
            Reference ID
            <input
              value={ledgerFilter.referenceId}
              onChange={(event) => setLedgerFilter((prev) => ({ ...prev, referenceId: event.target.value }))}
            />
          </label>
          <button
            type="submit"
            disabled={
              !token ||
              (currentUser?.role !== "FINANCE_ADMIN" &&
                currentUser?.role !== "ACCOUNTANT" &&
                currentUser?.role !== "AUDITOR")
            }
          >
            Lọc ledger
          </button>
        </form>
      </div>

      <div className="panel">
        <h3>Audit Logs Result</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Result</th>
                <th>Actor</th>
                <th>Correlation</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.createdAt}</td>
                  <td>{log.action}</td>
                  <td>
                    {log.entityType}:{log.entityId}
                  </td>
                  <td>{log.result}</td>
                  <td>{log.actor.username}</td>
                  <td>{log.correlationId ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h3>Ledger (immutable) & Reversal</h3>

        <form className="form-grid" onSubmit={handleCreateReversal}>
          <label>
            Target Ledger Entry ID
            <input
              value={ledgerFilter.reversalTargetId}
              onChange={(event) => setLedgerFilter((prev) => ({ ...prev, reversalTargetId: event.target.value }))}
              required
            />
          </label>
          <label>
            Reversal Reason
            <input
              value={ledgerFilter.reversalReason}
              onChange={(event) => setLedgerFilter((prev) => ({ ...prev, reversalReason: event.target.value }))}
              required
            />
          </label>
          <button
            type="submit"
            disabled={!token || (currentUser?.role !== "FINANCE_ADMIN" && currentUser?.role !== "ACCOUNTANT")}
          >
            Tạo reversal
          </button>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Entry Code</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Reference</th>
                <th>Reversal Of</th>
                <th>Created By</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {ledgerEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.entryCode}</td>
                  <td>{entry.type}</td>
                  <td>
                    {entry.amount} {entry.currency}
                  </td>
                  <td>
                    {entry.referenceType}:{entry.referenceId}
                  </td>
                  <td>{entry.reversalOfEntryCode ?? entry.reversalOfId ?? "-"}</td>
                  <td>{entry.createdBy.username}</td>
                  <td>{entry.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
