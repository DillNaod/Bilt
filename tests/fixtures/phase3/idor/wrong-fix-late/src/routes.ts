import express from "express";

export function requireAuth(req: any, res: any, next: any) {
  next();
}

const router = express.Router();

router.get("/api/documents/:id", requireAuth, async (req: any, res: any) => {
  const doc = await (globalThis as any).db.document.findUnique({
    where: { id: req.params.id },
  });
  // Check placed AFTER data access sink has already executed
  if (doc.userId !== req.user.id) {
    console.warn("Unauthorized access detected late");
  }
  res.json(doc);
});

export default router;
