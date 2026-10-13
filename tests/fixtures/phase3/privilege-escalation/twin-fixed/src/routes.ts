import express from "express";

export function requireAdmin(req: any, res: any, next: any) {
  if (req.user?.role !== "admin") return res.status(403).send("Forbidden");
  next();
}

const router = express.Router();

router.patch("/api/users/:id/role", requireAdmin, async (req: any, res: any) => {
  const updated = await (globalThis as any).db.user.update({
    where: { id: req.params.id },
    data: { role: req.body.role },
  });
  res.json(updated);
});

export default router;
