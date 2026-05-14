import { Cormorant_Garamond, EB_Garamond, Manrope } from "next/font/google";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { CharacterSelect } from "@/components/sleuth/CharacterSelect";
import type { ScriptDefinition } from "@/lib/sleuth/scripts.types";
import { loadScript } from "@/lib/sleuth/scripts";

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const proseFont = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const uiFont = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

interface ScriptPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ScriptPage({ params }: ScriptPageProps) {
  const { id } = await params;

  let script: ScriptDefinition;
  try {
    script = loadScript(id);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unknown Sleuth script:")) {
      notFound();
    }
    throw error;
  }

  const headerStore = await headers();
  const baseUrl = resolveBaseUrl(headerStore);
  void warmScriptAssets(baseUrl, script);

  return (
    <main className="min-h-screen overflow-hidden bg-[#120d0c] text-[#f5ede0]">
      <div className="relative isolate min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(168,51,26,0.2),transparent_26%),radial-gradient(circle_at_78%_14%,rgba(214,178,116,0.12),transparent_20%),linear-gradient(180deg,#2a1715_0%,#181111_42%,#0f0b0b_100%)]">
        <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:110px_110px]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(255,244,214,0.1),transparent_58%)]" />

        <section className="relative mx-auto flex min-h-screen w-full max-w-[92rem] flex-col px-5 pb-12 pt-8 sm:px-8 lg:px-12 lg:pb-16 lg:pt-12">
          <div className="max-w-[42rem]">
            <div
              className={`${uiFont.className} text-[0.72rem] uppercase tracking-[0.45em] text-[#b58f6b]`}
            >
              Choose who you become.
            </div>
            <h1
              className={`${displayFont.className} mt-4 max-w-[12ch] text-[4.5rem] leading-[0.88] text-[#f3e6d2] sm:text-[5.5rem] lg:text-[6.5rem]`}
            >
              {script.title}
            </h1>
            <p
              className={`${proseFont.className} mt-5 max-w-[34rem] text-[1.15rem] leading-relaxed text-[#d5c5b1] sm:text-[1.25rem]`}
            >
              {script.synopsis}
            </p>
          </div>

          <div className="mt-10 lg:mt-12">
            <CharacterSelect
              scriptId={script.id}
              cast={script.cast}
              displayFontClassName={displayFont.className}
              bodyFontClassName={proseFont.className}
              uiFontClassName={uiFont.className}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function resolveBaseUrl(headerStore: Headers): string {
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const protocol = forwardedProto ?? "http";
  const forwardedHost = headerStore.get("x-forwarded-host");
  const host = forwardedHost ?? headerStore.get("host");

  if (!host) {
    throw new Error("Unable to resolve request host for Sleuth asset warmup.");
  }

  return `${protocol}://${host}`;
}

async function warmScriptAssets(baseUrl: string, script: ScriptDefinition): Promise<void> {
  const secret = process.env.SLEUTH_SECRET;
  if (!secret) {
    return;
  }

  const headers = {
    "content-type": "application/json",
    "x-sleuth-secret": secret,
  };

  const requests = [
    fetch(`${baseUrl}/api/sleuth/worlds/generate`, {
      method: "POST",
      headers,
      cache: "no-store",
      body: JSON.stringify({
        script_id: script.id,
        world_prompt: script.worldPrompt,
        display_name: script.title,
      }),
    }),
    fetch(`${baseUrl}/api/sleuth/portraits/generate`, {
      method: "POST",
      headers,
      cache: "no-store",
      body: JSON.stringify({
        script_id: script.id,
      }),
    }),
  ];

  try {
    await Promise.allSettled(requests);
  } catch {
    // Fire-and-forget warmup; the page should render even if background jobs fail.
  }
}
