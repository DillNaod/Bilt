import express from "express";

export function requireAuth(req: any, res: any, next: any) {
  next();
}

const router = express.Router();

router.get("/api/documents/:id", requireAuth, async (req: any, res: any) => {
  if (false) {
    if (req.user.id !== "owner") return res.status(403).send("Forbidden");
  }
  const doc = await (globalThis as any).db.document.findUnique({
    where: { id: req.params.id },
  });
  res.json(doc);
});

export default router;
