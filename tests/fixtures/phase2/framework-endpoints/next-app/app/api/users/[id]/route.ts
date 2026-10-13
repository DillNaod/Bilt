export function requireAuth(handler: any) {
  return async (req: any) => handler(req);
}

export const GET = requireAuth(async function getProfile(req: any) {
  return Response.json({ id: 1 });
});
