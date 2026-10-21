import type { VerificationResult } from "../../types/index.js";

/**
 * Standard verification utilities for automated fixes.
 */
export function createVerificationResult(
  passed: boolean,
  message: string,
): VerificationResult {
  return { passed, message };
}

export function verifyContains(
  content: string,
  needle: string,
  successMsg: string,
  failMsg: string,
): VerificationResult {
  if (content.includes(needle)) {
    return { passed: true, message: successMsg };
  }
  return { passed: false, message: failMsg };
}

export function verifyMatches(
  content: string,
  regex: RegExp,
  successMsg: string,
  failMsg: string,
): VerificationResult {
  if (regex.test(content)) {
    return { passed: true, message: successMsg };
  }
  return { passed: false, message: failMsg };
}

export function verifyNotMatches(
  content: string,
  regex: RegExp,
  successMsg: string,
  failMsg: string,
): VerificationResult {
  if (!regex.test(content)) {
    return { passed: true, message: successMsg };
  }
  return { passed: false, message: failMsg };
}
