import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/db/prisma/client";
import type { AuthContext } from "@/modules/shared";

import { runDueRecurringTemplates } from "./recurring-service";

const DEFAULT_INTERVAL_MS = 60_000;
const MIN_INTERVAL_MS = 15_000;

type SchedulerState = typeof globalThis & {
  __recurringSchedulerInitialized?: boolean;
  __recurringSchedulerBusy?: boolean;
  __recurringSchedulerTimer?: ReturnType<typeof setInterval>;
};

const schedulerState = globalThis as SchedulerState;

function readSchedulerEnabled() {
  return process.env.RECURRING_SCHEDULER_ENABLED !== "false";
}

function readSchedulerIntervalMs() {
  const raw = process.env.RECURRING_SCHEDULER_INTERVAL_MS;
  if (!raw) {
    return DEFAULT_INTERVAL_MS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < MIN_INTERVAL_MS) {
    return DEFAULT_INTERVAL_MS;
  }

  return Math.floor(parsed);
}

async function resolveSchedulerAuthContext(): Promise<AuthContext | null> {
  const financeAdmin = await prisma.user.findFirst({
    where: { isActive: true, role: "FINANCE_ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, email: true },
  });

  if (financeAdmin) {
    return {
      userId: financeAdmin.id,
      role: financeAdmin.role,
      email: financeAdmin.email,
    };
  }

  const accountant = await prisma.user.findFirst({
    where: { isActive: true, role: "ACCOUNTANT" },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, email: true },
  });

  if (!accountant) {
    return null;
  }

  return {
    userId: accountant.id,
    role: accountant.role,
    email: accountant.email,
  };
}

async function runSchedulerTick() {
  if (schedulerState.__recurringSchedulerBusy) {
    return;
  }

  schedulerState.__recurringSchedulerBusy = true;

  try {
    const auth = await resolveSchedulerAuthContext();
    if (!auth) {
      console.warn("[recurring-scheduler] No active FINANCE_ADMIN/ACCOUNTANT user found. Skip this tick.");
      return;
    }

    const result = await runDueRecurringTemplates(auth, `recurring-scheduler-${randomUUID()}`);
    if (result.scanned > 0 || result.failures.length > 0) {
      console.info(
        `[recurring-scheduler] scanned=${result.scanned} created=${result.created} failures=${result.failures.length}`,
      );
    }
  } catch (error) {
    console.error("[recurring-scheduler] Tick failed", error);
  } finally {
    schedulerState.__recurringSchedulerBusy = false;
  }
}

export function startRecurringScheduler() {
  if (!readSchedulerEnabled()) {
    return;
  }

  if (schedulerState.__recurringSchedulerInitialized) {
    return;
  }

  schedulerState.__recurringSchedulerInitialized = true;

  const intervalMs = readSchedulerIntervalMs();
  schedulerState.__recurringSchedulerTimer = setInterval(() => {
    void runSchedulerTick();
  }, intervalMs);

  if (typeof schedulerState.__recurringSchedulerTimer.unref === "function") {
    schedulerState.__recurringSchedulerTimer.unref();
  }

  void runSchedulerTick();
  console.info(`[recurring-scheduler] Started with interval=${intervalMs}ms`);
}

export function stopRecurringScheduler() {
  if (schedulerState.__recurringSchedulerTimer) {
    clearInterval(schedulerState.__recurringSchedulerTimer);
  }

  schedulerState.__recurringSchedulerTimer = undefined;
  schedulerState.__recurringSchedulerBusy = false;
  schedulerState.__recurringSchedulerInitialized = false;
}
