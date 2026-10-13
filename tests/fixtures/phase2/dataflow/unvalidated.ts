export async function createUser(req: any, res: any) {
  const user = await db.user.create({
    data: req.body,
  });
  return res.json(user);
}
