import express from 'express';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const router = express.Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.headers.authorization) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// 1. SEC-API-002: IDOR / BOLA (Auth present, but no ownership check against session user)
// Also SEC-API-005: Sensitive response data exposure (passwordHash returned)
router.get('/api/users/:id', requireAuth, async (req, res) => {
  const user = await db.user.findUnique({
    where: { id: req.params.id },
  });
  // Exposes entire user object including passwordHash!
  res.json(user);
});

// 2. SEC-API-003: Mass Assignment & SEC-FLOW-001: Unvalidated data flow to DB
router.put('/api/users/:id', requireAuth, async (req, res) => {
  const updated = await db.user.update({
    where: { id: req.params.id },
    data: req.body, // Unvalidated mass assignment!
  });
  res.json(updated);
});

// 3. SEC-API-001: Missing Authentication on sensitive admin endpoint
router.get('/admin/users', async (req, res) => {
  const users = await db.user.findMany();
  res.json(users);
});

// 4. SEC-PRIV-001: Client-Supplied Privilege Flag
router.post('/api/users/promote', requireAuth, async (req, res) => {
  if (req.body.isAdmin === true || req.body.role === 'admin') {
    await db.user.update({
      where: { id: req.params.id },
      data: { isAdmin: true, role: 'admin' },
    });
    return res.json({ success: true });
  }
  res.status(403).json({ error: 'Forbidden' });
});

export default router;
