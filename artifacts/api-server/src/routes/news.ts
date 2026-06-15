import { Router, type IRouter } from "express";
import { getForexNews } from "../services/newsService";

const router: IRouter = Router();

router.get("/news", async (_req, res): Promise<void> => {
  const events = await getForexNews();
  res.json(events);
});

export default router;
