import { Router, type IRouter } from "express";
import healthRouter from "./health";
import userRouter from "./user";
import analyzeRouter from "./analyze";
import historyRouter from "./history";
import propfirmRouter from "./propfirm";
import newsRouter from "./news";
import adminRouter from "./admin";
import botRouter from "./bot";
import marketplaceRouter from "./marketplace";
import notesRouter from "./notes";
import alertsRouter from "./alerts";
import analyticsRouter from "./analytics";
import riskRouter from "./risk";
import chatRouter from "./chat";
import robotRentalRouter from "./robot-rental";

const router: IRouter = Router();

router.use(healthRouter);
router.use(userRouter);
router.use(analyzeRouter);
router.use(historyRouter);
router.use(propfirmRouter);
router.use(newsRouter);
router.use(adminRouter);
router.use(botRouter);
router.use(marketplaceRouter);
router.use(notesRouter);
router.use(alertsRouter);
router.use(analyticsRouter);
router.use(riskRouter);
router.use(chatRouter);
router.use(robotRentalRouter);

export default router;
