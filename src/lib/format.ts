/**
 * Capitalize the first letter of each word for storage in the database.
 * Chat/UI can stay as-is; use this when persisting names to Supabase.
 * e.g. "john" -> "John", "mary jane" -> "Mary Jane"
 */
export function capitalizeName(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return trimmed;
  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
