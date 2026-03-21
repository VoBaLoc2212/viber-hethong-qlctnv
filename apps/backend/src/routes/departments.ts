import { Router, type IRouter } from "express";
import { db, departmentsTable } from "@workspace/db";
import { CreateDepartmentBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/departments", async (req, res) => {
  try {
    const departments = await db.select().from(departmentsTable).orderBy(departmentsTable.name);
    res.json(departments);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch departments");
    res.status(500).json({ error: "Failed to fetch departments" });
  }
});

router.post("/departments", async (req, res) => {
  try {
    const body = CreateDepartmentBody.parse(req.body);
    const [department] = await db
      .insert(departmentsTable)
      .values({
        name: body.name,
        code: body.code,
        budgetAllocated: String(body.budgetAllocated),
      })
      .returning();
    res.status(201).json(department);
  } catch (err) {
    req.log.error({ err }, "Failed to create department");
    res.status(500).json({ error: "Failed to create department" });
  }
});

export default router;
