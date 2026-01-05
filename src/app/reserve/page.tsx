import Link from "next/link";
import { nextEvent } from "@/config/event";

// Generate spiral path points (clockwise from center, starting right)
function generateSpiralPath(turns = 4, maxRadius = 120) {
  const points = [];
  const steps = 200;
  
  for (let i = 0; i <= steps; i++) {
    // Start at angle 0 (pointing right), go counter-clockwise (negative angles)
    const t = -(i / steps) * turns * Math.PI * 2;
    const radius = (i / steps) * maxRadius;
    const x = radius * Math.cos(t);
    const y = -radius * Math.sin(t); // Flip on horizontal axis (negate y)
    points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
  }
  
  return points.join(' ');
}

export default function page() {
  const spiralPath = generateSpiralPath(4, 120);
  return (
    <main className="relative h-screen overflow-hidden bg-[#111111] text-white">
      <div className="relative mx-auto flex h-screen max-w-2xl flex-col px-6 pt-20 pb-10">
        <div className="flex flex-1 items-center justify-between">
          <div>
            <h1 className="text-sm">you're in.</h1>

            <p className="mt-6 text-sm text-white/70">
              thank you for reserving your spot.
            </p>

            <div className="mt-8 space-y-1">
              <p className="text-sm text-white/90">
                {nextEvent.date} • {nextEvent.time}
              </p>
              <p className="text-sm text-white/90">{nextEvent.place}</p>
              <p className="text-sm text-white/90">{nextEvent.address}</p>
            </div>

            <div className="mt-8">
              <Link
                href="/manifesto"
                className="text-sm text-[#05fd00] hover:text-[#05fd00]/80"
              >
                read the manifesto →
              </Link>
            </div>

            <p className="mt-8 text-sm text-white/50">
              see you there.
            </p>
          </div>

          {/* Spiral */}
          <div className="pointer-events-none flex-shrink-0">
            <svg
              width="300"
              height="300"
              viewBox="0 0 300 300"
              className="text-white/15"
            >
              <defs>
                <style>{`
                  .spiral-path {
                    fill: none;
                    stroke: currentColor;
                    stroke-width: 1.2;
                    stroke-linecap: round;
                    stroke-linejoin: round;
                    stroke-dasharray: 3000;
                    stroke-dashoffset: 3000;
                    animation: drawSpiral 18s ease-in-out forwards;
                  }
                  @keyframes drawSpiral {
                    to {
                      stroke-dashoffset: 0;
                    }
                  }
                `}</style>
              </defs>
              <g transform="translate(150, 150)">
                <path
                  className="spiral-path"
                  d={spiralPath}
                />
              </g>
            </svg>
          </div>
        </div>
      </div>
    </main>
  );
}