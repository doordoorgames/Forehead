import { Router, type IRouter } from "express";
import healthRouter from "./health";
import categoriesRouter from "./categories";
import adminRouter from "./admin";
import roomsRouter from "./rooms";

const router: IRouter = Router();

router.use(healthRouter);
router.use(categoriesRouter);
router.use(adminRouter);
router.use(roomsRouter);

export default router;
