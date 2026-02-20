/**
 * Strip all HTML/XML tags and null bytes from a string to prevent stored XSS.
 * Also collapses excessive whitespace.
 */
export function stripTags(str: string): string {
  return str
    .replace(/\0/g, "")           // null bytes
    .replace(/<[^>]*>/g, "")      // HTML/XML tags
    .replace(/javascript\s*:/gi, "") // javascript: URIs
    .replace(/on\w+\s*=/gi, "")   // inline event handlers (onerror=, onclick=, etc.)
    .trim();
}

/**
 * Zod .transform() compatible wrapper — use as .transform(sanitizeStr)
 */
export const sanitizeStr = (s: string) => stripTags(s);
