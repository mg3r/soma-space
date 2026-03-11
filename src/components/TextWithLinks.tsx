"use client";

type Segment =
  | { type: "text"; value: string }
  | { type: "url"; value: string; href: string }
  | { type: "email"; value: string; href: string };

function parseTextWithLinks(text: string): Segment[] {
  if (!text) return [];

  const segments: Segment[] = [];
  const urlRegex = /https?:\/\/[^\s]+|www\.[^\s]+/g;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  type Match = { start: number; end: number; type: "url" | "email"; value: string; href: string };
  const matches: Match[] = [];

  let m: RegExpExecArray | null;
  while ((m = urlRegex.exec(text)) !== null) {
    const value = m[0];
    const href = value.startsWith("www.") ? `https://${value}` : value;
    matches.push({ start: m.index, end: m.index + value.length, type: "url", value, href });
  }
  while ((m = emailRegex.exec(text)) !== null) {
    const value = m[0];
    matches.push({ start: m.index, end: m.index + value.length, type: "email", value, href: `mailto:${value}` });
  }

  // Sort by start, then prefer URL over email when overlapping
  matches.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return (a.type === "url" ? 0 : 1) - (b.type === "url" ? 0 : 1);
  });

  // Filter out overlaps: if two matches overlap, keep the first (already sorted by start)
  const merged: Match[] = [];
  let lastEnd = -1;
  for (const match of matches) {
    if (match.start >= lastEnd) {
      merged.push(match);
      lastEnd = match.end;
    }
  }

  // Build segments from merged matches
  let pos = 0;
  for (const match of merged) {
    if (match.start > pos) {
      segments.push({ type: "text", value: text.slice(pos, match.start) });
    }
    segments.push({
      type: match.type,
      value: match.value,
      href: match.href,
    } as Segment);
    pos = match.end;
  }
  if (pos < text.length) {
    segments.push({ type: "text", value: text.slice(pos) });
  }

  return segments;
}

type Props = {
  text: string;
  primaryColor: string;
  className?: string;
};

export default function TextWithLinks({ text, primaryColor, className = "" }: Props) {
  const segments = parseTextWithLinks(text);

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          return <span key={i}>{seg.value}</span>;
        }
        const isEmail = seg.type === "email";
        return (
          <a
            key={i}
            href={seg.href}
            target={isEmail ? undefined : "_blank"}
            rel={isEmail ? undefined : "noopener noreferrer"}
            className="hover:opacity-80"
            style={{ color: primaryColor }}
          >
            {seg.value}
          </a>
        );
      })}
    </span>
  );
}
