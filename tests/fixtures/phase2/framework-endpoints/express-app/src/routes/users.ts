import express from "express";

const router = express.Router();

export function requireAuth(req: any, res: any, next: any) {
  next();
}

export function getProfile(req: any, res: any) {
  res.json({ id: req.params.id });
}

router.get("/api/users/:id", requireAuth, getProfile);

export default router;
