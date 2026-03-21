import { Router, type IRouter } from "express";
import healthRouter from "./health";
import transactionsRouter from "./transactions";
import departmentsRouter from "./departments";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(transactionsRouter);
router.use(departmentsRouter);
router.use(dashboardRouter);

export default router;
