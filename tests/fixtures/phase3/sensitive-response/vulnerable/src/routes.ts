import express from "express";

const router = express.Router();

router.get("/api/users/me", async (req: any, res: any) => {
  const user = await (globalThis as any).db.user.findUnique({
    where: { id: req.user.id },
  });
  // Whole entity returned including passwordHash
  res.json({
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
  });
});

export default router;
