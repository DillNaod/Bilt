import crypto from "node:crypto";

export function generateDesignFingerprint(
  ruleId: string,
  file?: string,
  line?: number,
  extra?: string,
): string {
  const hash = crypto.createHash("sha256");
  hash.update(ruleId);
  if (file) hash.update(`:${file}`);
  if (line !== undefined) hash.update(`:${line}`);
  if (extra) hash.update(`:${extra}`);
  return hash.digest("hex");
}
