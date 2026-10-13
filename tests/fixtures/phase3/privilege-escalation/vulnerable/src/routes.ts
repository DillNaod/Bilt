import express from "express";

const router = express.Router();

router.patch("/api/users/:id/role", async (req: any, res: any) => {
  const updated = await (globalThis as any).db.user.update({
    where: { id: req.params.id },
    data: { role: req.body.role },
  });
  res.json(updated);
});

export default router;
