"use client";

import Link from "next/link";
import { useEventConfig } from "@/hooks/useEventConfig";

export default function page() {
  const { primaryColor, backgroundColor, isLoading } = useEventConfig();

  if (isLoading) {
    return (
      <main className="min-h-screen text-white" style={{ backgroundColor: "#111111" }}>
        <div className="mx-auto max-w-2xl px-6 py-10">
          <p className="text-sm text-white/50">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-white" style={{ backgroundColor }}>
      <div className="mx-auto max-w-2xl px-6 py-10">
        <header className="mb-10">
          <Link href="/" className="text-xs text-white/50 hover:text-white/80">
            ← back
          </Link>
        </header>

        <h1 className="text-2xl tracking-tight">manifesto</h1>

        <div className="mt-8 space-y-6 text-sm text-white/80 leading-relaxed">
          <p>
            soma space is a guided movement gathering where people explore free movement, music, and embodied presence together.
          </p>

          <p style={{ color: primaryColor }}>connect. accept. discover.</p>

          <p>
            a space where movement is freedom. release. connection. expression.
            and fully welcome in any form.
          </p>

          <p>
            an invitation. to share your inner realm outward. exactly as you are. from the safety of your body and the collective container that we
            create.
          </p>

          <p>
            here, tune in to music and sound designed to facilitate self discovery.
          </p>

          <p>
            here, move without limitation while remaining fully connected and
            present within yourself and the environment around you.
          </p>

          <div className="pt-4 space-y-4">
            <p style={{ color: primaryColor }}>the flow.</p>

            <div className="space-y-0">
              <p>arrive.</p>
              <p>
                listen. stretch. crawl. jump. shake. go inside. let your body move
                to its own rhythm as you meet the music.
              </p>
            </div>

            <div className="space-y-0">
              <p>connect.</p>
              <p>
                let yourself be seen in motion by others as you are guided in connection with your feelings, thoughts, and emotions — all through the non verbal expressions of your body.
              </p>
            </div>

            <div className="space-y-0">
              <p>reflect.</p>
              <p>
                receive simple prompts before gathering to share about your
                experience in group activities.
              </p>
            </div>

            <div className="space-y-0">
              <p>reconnect.</p>
              <p>
                with the music, the space, and the people around you as you move
                through one last dance.
              </p>
            </div>

            <div className="space-y-0">
              <p>close.</p>
              <p>
                group gratitude, poetry, and a grounding exhalation. leave feeling
                rested, connected, and renewed.
              </p>
            </div>
          </div>

          <div className="pt-4 space-y-4">
            <p style={{ color: primaryColor }}>the agreement.</p>

            <p>
              this gathering is held as a non violent, respectful, substance free, and consensual space.
            </p>

            <p>
              by entering soma space, you agree to the following:
            </p>

            <div className="space-y-3 pl-4">
              <p>
                • arrive and participate without the influence of drugs or alcohol
              </p>
              <p>
                • move and express yourself in ways that honor the safety of yourself and others
              </p>
              <p>
                • engage in touch only when it is clearly invited and mutually consented to
              </p>
              <p>
                • communicate and respond with care, curiosity, and respect
              </p>
              <p>
                • refrain from yelling, aggressive behavior, or actions that disrupt the shared container
              </p>
              <p>
                • hold a non judgmental attitude toward yourself and others
              </p>
              <p>
                • respect personal boundaries, identities, and lived experiences
              </p>
              <p>
                • take responsibility for your own body, emotions, and capacity
              </p>
              <p>
                • step back, rest, or seek support at any time if you feel overwhelmed
              </p>
            </div>

            <p>
              this is a shared container. we each contribute to its safety, presence, and integrity.
            </p>
          </div>

          <div className="pt-4 space-y-4">
            <p style={{ color: primaryColor }}>shared contribution.</p>

            <p>
              we offer a sliding scale and trust each person to give what they are able. no one is ever turned away for lack of funds.
            </p>

            <p>
              if you need support, please reach out.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}