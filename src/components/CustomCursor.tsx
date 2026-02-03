"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CURSOR_SIZE = 12;
const TRAIL_DOT_SIZE = 4;
const TRAIL_FADE_MS = 700;
const TRAIL_THROTTLE_MS = 25;
const TRAIL_MIN_DISTANCE = 10;
const TICK_MS = 50;

type TrailParticle = { id: number; x: number; y: number; createdAt: number };

export default function CustomCursor() {
  const [primaryColor, setPrimaryColor] = useState("#05fd00");
  const [isDesktop, setIsDesktop] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [particles, setParticles] = useState<TrailParticle[]>([]);
  const [tick, setTick] = useState(0);
  const lastTrailRef = useRef({ x: 0, y: 0, t: 0 });
  const idRef = useRef(0);

  // Fetch active event primary color
  useEffect(() => {
    let cancelled = false;
    fetch("/api/event-config")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data?.config?.primary_color) {
          setPrimaryColor(data.config.primary_color);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Only enable on pointer: fine (desktop)
  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    const ok = mq.matches;
    setIsDesktop(ok);
    const handler = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Hide default cursor when custom cursor is active
  useEffect(() => {
    if (!isDesktop) return;
    document.body.setAttribute("data-custom-cursor", "true");
    return () => document.body.removeAttribute("data-custom-cursor");
  }, [isDesktop]);

  // Tick to age trail particles and trim old ones
  useEffect(() => {
    if (!isDesktop) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setTick(now);
      setParticles((prev) => prev.filter((p) => now - p.createdAt < TRAIL_FADE_MS));
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [isDesktop]);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      const x = e.clientX;
      const y = e.clientY;
      setPos({ x, y });

      if (!isDesktop) return;

      const now = Date.now();
      const { x: lx, y: ly, t: lt } = lastTrailRef.current;
      const dist = Math.hypot(x - lx, y - ly);
      const elapsed = now - lt;

      if (elapsed >= TRAIL_THROTTLE_MS && dist >= TRAIL_MIN_DISTANCE) {
        lastTrailRef.current = { x, y, t: now };
        idRef.current += 1;
        setParticles((prev) => [
          ...prev.slice(-80),
          { id: idRef.current, x, y, createdAt: now },
        ]);
      }
    },
    [isDesktop]
  );

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, [onMouseMove]);

  if (!isDesktop) return null;

  return (
    <>
      {/* Cursor circle — only show after first move to avoid flash at 0,0 */}
      {pos && (
        <div
          className="pointer-events-none fixed z-[9999] rounded-full transition-none"
          style={{
            left: pos.x,
            top: pos.y,
            width: CURSOR_SIZE,
            height: CURSOR_SIZE,
            marginLeft: -CURSOR_SIZE / 2,
            marginTop: -CURSOR_SIZE / 2,
            backgroundColor: primaryColor,
            boxShadow: `0 0 0 1px ${primaryColor}40`,
          }}
          aria-hidden
        />
      )}
      {/* Trail dust */}
      {particles.map((p) => {
        const age = tick - p.createdAt;
        const opacity = Math.max(0, 1 - age / TRAIL_FADE_MS);
        return (
          <div
            key={p.id}
            className="pointer-events-none fixed z-[9998] rounded-full"
            style={{
              left: p.x,
              top: p.y,
              width: TRAIL_DOT_SIZE,
              height: TRAIL_DOT_SIZE,
              marginLeft: -TRAIL_DOT_SIZE / 2,
              marginTop: -TRAIL_DOT_SIZE / 2,
              backgroundColor: primaryColor,
              opacity,
            }}
            aria-hidden
          />
        );
      })}
    </>
  );
}
