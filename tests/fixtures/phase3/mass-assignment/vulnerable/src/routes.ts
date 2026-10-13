import express from "express";

const router = express.Router();

router.put("/api/profile", async (req: any, res: any) => {
  const updated = await (globalThis as any).db.user.update({
    where: { id: req.user.id },
    data: req.body,
  });
  res.json(updated);
});

export default router;
