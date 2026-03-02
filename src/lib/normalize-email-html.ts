/**
 * Normalize email HTML to fix excessive spacing from pasted content (Word, Docs, etc.).
 * Strips inline margin/line-height and removes empty block elements.
 * Safe to use on both server and client (no Resend or other server deps).
 */
export function normalizeEmailHtml(html: string): string {
  let result = html;

  // Remove inline spacing properties from style attributes (preserve other styles)
  result = result.replace(
    /style\s*=\s*["']([^"']*)["']/gi,
    (_, styleContent) => {
      const cleaned = styleContent
        .replace(/\s*(margin|margin-top|margin-bottom|margin-left|margin-right|line-height)\s*:\s*[^;]+(!important)?\s*;?\s*/gi, "")
        .replace(/\s*;\s*;/g, ";")
        .trim()
        .replace(/^;\s*|;\s*$/g, "");
      return cleaned ? `style="${cleaned}"` : "";
    }
  );

  // Remove empty style attributes (e.g. style="" or style='')
  result = result.replace(/\s+style\s*=\s*["']['"]/gi, "");

  // Remove empty paragraphs and divs
  result = result.replace(/<p[^>]*>\s*<\/p>/gi, "");
  result = result.replace(/<p[^>]*><br\s*\/?>\s*<\/p>/gi, "");
  result = result.replace(/<div[^>]*>\s*<\/div>/gi, "");

  return result.trim();
}
