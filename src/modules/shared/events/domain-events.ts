export type DomainEventName =
  | "budget.reserved"
  | "budget.released"
  | "transaction.executed"
  | "cashbook.posted"
  | "ledger.appended"
  | "approval.approved"
  | "approval.rejected";

export type DomainEvent<TPayload = unknown> = {
  id: string;
  name: DomainEventName;
  payload: TPayload;
  occurredAt: string;
};
