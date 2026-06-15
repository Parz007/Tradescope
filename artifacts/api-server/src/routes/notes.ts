import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tradeNotesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/notes/:analysisId", async (req, res): Promise<void> => {
  const { analysisId } = req.params as { analysisId: string };
  const [note] = await db.select().from(tradeNotesTable).where(eq(tradeNotesTable.analysisId, analysisId)).limit(1);
  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  res.json({ ...note, id: note.id, createdAt: note.createdAt.toISOString(), updatedAt: note.updatedAt.toISOString() });
});

router.post("/notes/:analysisId", async (req, res): Promise<void> => {
  const { analysisId } = req.params as { analysisId: string };
  const { userId, note, mood, lessonsLearned } = req.body as {
    userId: string;
    note: string;
    mood?: string | null;
    lessonsLearned?: string | null;
  };

  if (!userId || !note) {
    res.status(400).json({ error: "userId and note are required" });
    return;
  }

  const existing = await db.select().from(tradeNotesTable).where(eq(tradeNotesTable.analysisId, analysisId)).limit(1);
  const now = new Date();

  if (existing.length > 0) {
    const [updated] = await db.update(tradeNotesTable)
      .set({ note, mood: mood ?? null, lessonsLearned: lessonsLearned ?? null, updatedAt: now })
      .where(eq(tradeNotesTable.analysisId, analysisId))
      .returning();
    res.json({ ...updated, id: updated.id, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
    return;
  }

  const [created] = await db.insert(tradeNotesTable).values({
    analysisId,
    userId,
    note,
    mood: mood ?? null,
    lessonsLearned: lessonsLearned ?? null,
  }).returning();

  res.json({ ...created, id: created.id, createdAt: created.createdAt.toISOString(), updatedAt: created.updatedAt.toISOString() });
});

export default router;
