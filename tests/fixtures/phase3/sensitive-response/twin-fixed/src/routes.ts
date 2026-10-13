import express from "express";

const router = express.Router();

router.get("/api/users/me", async (req: any, res: any) => {
  const user = await (globalThis as any).db.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, email: true, name: true },
  });
  // DTO field boundary: sensitive fields excluded
  res.json({
    id: user.id,
    email: user.email,
  });
});

export default router;
