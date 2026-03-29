export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { startRecurringScheduler } = await import("@/modules/transaction/services/recurring-scheduler");
  startRecurringScheduler();
}
