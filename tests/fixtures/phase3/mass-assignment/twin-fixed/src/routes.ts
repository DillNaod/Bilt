import express from "express";
import { z } from "zod";

const profileSchema = z.object({
  bio: z.string(),
  displayName: z.string(),
});

const router = express.Router();

router.put("/api/profile", async (req: any, res: any) => {
  const validated = profileSchema.parse(req.body);
  const updated = await (globalThis as any).db.user.update({
    where: { id: req.user.id },
    data: validated,
  });
  res.json(updated);
});

export default router;
