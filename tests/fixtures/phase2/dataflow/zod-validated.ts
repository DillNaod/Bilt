import { z } from "zod";

const userSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

export async function updateUser(req: any, res: any) {
  const validated = userSchema.parse(req.body);
  const user = await db.user.update({
    where: { id: req.params.id },
    data: validated,
  });
  return res.json(user);
}
