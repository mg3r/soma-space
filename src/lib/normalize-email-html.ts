/**
 * Normalize email HTML to fix excessive spacing from pasted content (Word, Docs, etc.).
 * Strips inline margin/line-height (so template spacing applies); does NOT remove
 * empty block elements, which are used for intentional paragraph breaks in the editor.
 * Ensures p/div have inline margin for Gmail (many clients strip <style> blocks).
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

  // Ensure p and div have inline margin so Gmail and other clients show paragraph spacing
  // (many email clients strip <style> blocks; inline styles are reliable)
  const blockMargin = "margin: 0 0 10px 0";
  const ensureBlockMargin = (tag: string, match: string): string => {
    const styleMatch = match.match(/style\s*=\s*["']([^"']*)["']/i);
    if (styleMatch) {
      const style = styleMatch[1];
      if (/margin\s*:/i.test(style)) return match;
      const newStyle = style.trim() ? `${style}; ${blockMargin}` : blockMargin;
      return match.replace(/style\s*=\s*["'][^"']*["']/i, `style="${newStyle}"`);
    }
    return match.replace(/>$/, ` style="${blockMargin}">`);
  };
  result = result.replace(/<p(\s[^>]*)?>/gi, (m) => ensureBlockMargin("p", m));
  result = result.replace(/<div(\s[^>]*)?>/gi, (m) => ensureBlockMargin("div", m));

  return result.trim();
}
