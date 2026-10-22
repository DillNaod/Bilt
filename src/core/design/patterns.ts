export const GENERIC_SAAS_PATTERNS = [
  /the future of\b/i,
  /built for the modern\b/i,
  /supercharge your\b/i,
  /transform your workflow\b/i,
  /unlock your potential\b/i,
  /from idea to production\b/i,
  /built for developers, loved by teams\b/i,
  /next-gen\b/i,
  /streamline your\b/i,
  /all-in-one platform\b/i,
  /accelerate your\b/i,
  /seamlessly integrate\b/i,
  /say goodbye to\b/i,
  /bring your ideas to life\b/i,
];

export const ADJECTIVE_STACK_REGEX =
  /\b(powerful|seamless|intelligent|effortless|lightning-fast|blazing-fast|cutting-edge|revolutionary|intuitive|robust|scalable|modern)\b(?:[\s,]+and[\s,]+|[\s,]+)\b(powerful|seamless|intelligent|effortless|lightning-fast|blazing-fast|cutting-edge|revolutionary|intuitive|robust|scalable|modern)\b(?:[\s,]+and[\s,]+|[\s,]+)?\b(powerful|seamless|intelligent|effortless|lightning-fast|blazing-fast|cutting-edge|revolutionary|intuitive|robust|scalable|modern)?/i;

export const IT_IS_NOT_X_REGEX =
  /\b(?:it'?s not|not just|not another)\s+([a-zA-Z0-9_-]+)[,\s]+it'?s\b/i;

export const FAKE_URGENCY_REGEX =
  /\b(?:your workflow will never be the same|don'?t get left behind|the only tool you'?ll ever need|experience the difference today)\b/i;

export const FAKE_TESTIMONIAL_NAME_REGEX =
  /\b(?:CEO at TechCorp|Founder at StartupX|John D\.|Sarah M\.|Alex P\.|Jane Doe|John Doe)\b/i;

export const FAKE_COMPANY_REGEX =
  /\b(?:Acme Corp|TechCorp|StartupX|Initech|Pied Piper|Company A|Company B)\b/i;

export const EMOJI_REGEX =
  /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/u;
