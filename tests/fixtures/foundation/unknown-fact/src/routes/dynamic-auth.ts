// Dynamically loaded middleware that static analysis cannot resolve
export async function getAuthMiddleware(pluginName: string) {
  const mod = await import(`./plugins/${pluginName}.js`);
  return mod.authMiddleware;
}

export function handleProtectedResource(req: any, res: any) {
  res.json({ secret: 42 });
}
