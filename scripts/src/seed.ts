import { db, departmentsTable, transactionsTable } from "@workspace/db";

async function seed() {
  console.log("Seeding database...");

  const existingDepts = await db.select().from(departmentsTable);
  if (existingDepts.length > 0) {
    console.log("Database already seeded, skipping.");
    process.exit(0);
  }

  const departments = await db
    .insert(departmentsTable)
    .values([
      { name: "Engineering", code: "ENG", budgetAllocated: "250000" },
      { name: "Marketing", code: "MKT", budgetAllocated: "120000" },
      { name: "Operations", code: "OPS", budgetAllocated: "180000" },
      { name: "Human Resources", code: "HR", budgetAllocated: "80000" },
      { name: "Finance", code: "FIN", budgetAllocated: "60000" },
    ])
    .returning();

  console.log(`Created ${departments.length} departments`);

  const months = [
    new Date("2025-01-15"),
    new Date("2025-02-10"),
    new Date("2025-03-20"),
    new Date("2025-04-05"),
    new Date("2025-05-18"),
    new Date("2025-06-25"),
    new Date("2025-07-14"),
    new Date("2025-08-08"),
    new Date("2025-09-22"),
    new Date("2025-10-11"),
    new Date("2025-11-30"),
    new Date("2025-12-15"),
  ];

  const statuses: Array<"PENDING" | "APPROVED" | "REJECTED"> = ["APPROVED", "APPROVED", "APPROVED", "PENDING", "REJECTED"];
  const types: Array<"INCOME" | "EXPENSE"> = ["INCOME", "EXPENSE", "EXPENSE", "EXPENSE", "INCOME"];

  const transactionsData = [];
  let counter = 1;

  for (const month of months) {
    for (let i = 0; i < 5; i++) {
      const dept = departments[Math.floor(Math.random() * departments.length)];
      const type = types[i % types.length];
      const amount = type === "INCOME"
        ? (Math.random() * 50000 + 10000).toFixed(2)
        : (Math.random() * 30000 + 1000).toFixed(2);

      const date = new Date(month);
      date.setDate(date.getDate() + i * 2);

      transactionsData.push({
        transactionCode: `TXN-${String(counter).padStart(5, "0")}`,
        type,
        amount,
        description: type === "INCOME"
          ? `Revenue from ${dept.name} Q${Math.ceil(month.getMonth() / 3)}`
          : `Operating expense for ${dept.name}`,
        departmentId: dept.id,
        date,
        status: statuses[Math.floor(Math.random() * statuses.length)],
      });
      counter++;
    }
  }

  await db.insert(transactionsTable).values(transactionsData);
  console.log(`Created ${transactionsData.length} transactions`);
  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
