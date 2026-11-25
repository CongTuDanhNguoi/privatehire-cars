// Shared telephone normalization and search validation for SCRUM-25 / SCRUM-106.
// Used by both backend/ and web/ so search validation and formatting rules stay identical.

export const CUSTOMER_SEARCH_MESSAGES = {
  phoneRequired: "Enter a telephone number to search.",
  phoneFormat: "Enter a valid telephone number (10-15 digits, e.g. 07911 123456 or +44 7911 123456).",
} as const;

/**
 * Strips common telephone formatting separators (spaces, hyphens, parentheses, dots).
 */
export function stripPhoneSeparators(value: string): string {
  return value.trim().replace(/[\s\-().]/g, "");
}

/**
 * Normalizes a telephone number for matching across UK formats (+44, 0044, domestic 0)
 * while preserving international numbers with a leading '+'.
 */
export function normalizeSearchPhone(value: string): string {
  const compact = stripPhoneSeparators(value);
  if (!compact) return "";

  if (compact.startsWith("+44")) {
    const rest = compact.slice(3).replace(/^0/, "");
    return `0${rest}`;
  }
  if (compact.startsWith("0044")) {
    const rest = compact.slice(4).replace(/^0/, "");
    return `0${rest}`;
  }
  return compact;
}

/**
 * Validates a telephone search query. Returns "" when valid, or a user-facing error message.
 */
export function validateSearchPhone(value?: string): string {
  const normalized = normalizeSearchPhone(value ?? "");
  if (!normalized) return CUSTOMER_SEARCH_MESSAGES.phoneRequired;
  if (!/^\+?\d{10,15}$/.test(normalized)) return CUSTOMER_SEARCH_MESSAGES.phoneFormat;
  return "";
}
