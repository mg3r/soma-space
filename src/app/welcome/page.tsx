"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
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

function ReserveContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session_id");
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      console.log('No session_id in URL, redirecting to home');
      router.push('/');
      return;
    }

    // Verify payment
    const verifyPayment = async () => {
      try {
        // Use window.location.origin for client-side fetch
        const baseUrl = typeof window !== 'undefined' 
          ? window.location.origin 
          : 'https://entersoma.space';
        
        console.log('Verifying payment with session_id:', sessionId);
        console.log('Using baseUrl:', baseUrl);
        
        const res = await fetch(
          `/api/verify-stripe-session?session_id=${sessionId}`,
          { 
            cache: 'no-store',
            method: 'GET',
          }
        );

        console.log('Verification response status:', res.status);

        if (res.ok) {
          const data = await res.json();
          console.log('Verification response data:', data);
          
          if (data.verified) {
            console.log('Payment verified successfully');
            setIsVerified(true);
            // Fade in content after a short delay
            setTimeout(() => setShowContent(true), 100);
          } else {
            console.log('Payment not verified, redirecting to home');
            router.push('/');
          }
        } else {
          const errorData = await res.json().catch(() => ({}));
          console.error('Verification failed:', res.status, errorData);
          router.push('/');
        }
      } catch (error) {
        console.error("Payment verification error:", error);
        router.push('/');
      }
    };

    verifyPayment();
  }, [sessionId, router]);

  // Show loading state while verifying
  if (isVerified === null) {
    return (
      <main className="relative h-screen overflow-hidden bg-[#111111] text-white">
        <div className="relative mx-auto flex h-screen max-w-full md:max-w-2xl flex-col px-6 pt-20 pb-10">
          <div className="flex flex-1 items-center justify-between">
            <div className="opacity-0">
              {/* Placeholder to maintain layout */}
              <h1 className="text-sm">you&apos;re in.</h1>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // If not verified, this won't render (redirect happens)
  if (!isVerified) {
    return null;
  }

  const spiralPath = generateSpiralPath(4, 120);
  
  return (
    <main className="relative h-screen overflow-hidden bg-[#111111] text-white">
      <div className="relative mx-auto flex h-screen max-w-full md:max-w-2xl flex-col px-6 pt-20 pb-10">
        <div className="flex flex-1 items-center justify-between gap-4 md:gap-0">
          <div
            className={[
              "transition-opacity duration-1000 flex-1",
              showContent ? "opacity-100" : "opacity-0",
            ].join(" ")}
          >
            <h1 className="text-sm">you&apos;re in.</h1>

            <p className="mt-6 text-sm text-white/70">
              thank you for reserving your spot at RENEWAL.
            </p>

            <p className="mt-6 text-sm text-white/70 leading-relaxed">
              an evening of guided movement, music, and embodied presence. come as you are.
            </p>

            <div className="mt-8 space-y-1">
              <p className="text-sm text-white/90">
                {nextEvent.date} • {nextEvent.time}
              </p>
              <p className="text-sm text-white/90">{nextEvent.place}</p>
              <p className="text-sm text-white/90">{nextEvent.address}</p>
            </div>

            <p className="mt-8 text-sm text-white/70 leading-relaxed">
              soma space is held as a respectful, non violent, and consensual container where all bodies are welcome.
            </p>

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
              width="200"
              height="200"
              viewBox="0 0 300 300"
              className="text-white/15 md:w-[300px] md:h-[300px]"
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

export default function Page() {
  return (
    <Suspense fallback={
      <main className="relative h-screen overflow-hidden bg-[#111111] text-white">
        <div className="relative mx-auto flex h-screen max-w-full md:max-w-2xl flex-col px-6 pt-20 pb-10">
          <div className="flex flex-1 items-center justify-between">
            <div className="opacity-0">
              <h1 className="text-sm">you&apos;re in.</h1>
            </div>
          </div>
        </div>
      </main>
    }>
      <ReserveContent />
    </Suspense>
  );
}
