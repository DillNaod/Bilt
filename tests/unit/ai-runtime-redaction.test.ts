import { describe, expect, it } from "vitest";
import { redactKnownSecrets } from "../../src/core/safety/sanitizer.js";

describe("AI boundary redaction contract", () => {
  it("redacts provider-shaped secrets from prompts and responses", () => {
    const secret = "sk-live-123456789012345678901234567890";
    const prompt = redactKnownSecrets(`Explain ${secret}`);
    const response = redactKnownSecrets(`The value is ${secret}`);

    expect(prompt).not.toContain(secret);
    expect(response).not.toContain(secret);
    expect(prompt).toContain("sk-l***");
    expect(response).toContain("sk-l***");
  });
});
