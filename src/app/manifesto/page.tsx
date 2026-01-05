import Link from "next/link";

export default function page() {
  return (
    <main className="min-h-screen bg-[#111111] text-white">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <header className="mb-10">
          <Link href="/" className="text-xs text-white/50 hover:text-white/80">
            ← back
          </Link>
        </header>

        <h1 className="text-2xl tracking-tight">manifesto</h1>

        <div className="mt-8 space-y-6 text-sm text-white/80 leading-relaxed">
          <p className="text-[#05fd00]">connect. accept. discover.</p>

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
            <p className="text-[#05fd00]">the flow.</p>

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
                let yourself be seen in motion by others as you are guided in
                connection with your feelings, thoughts, and emotions — all
                through non verbal expressions of your body.
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
            <p className="text-[#05fd00]">the agreement.</p>

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
        </div>
      </div>
    </main>
  );
}