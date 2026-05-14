"use client";

import { Check, Copy, DoorOpen, Download, Gamepad2, ImageIcon, Loader2 } from "lucide-react";
import { useState } from "react";

import type { ScenePlan } from "@/lib/sceneSchema";

type SceneImageMap = Record<string, string | null>;

type SceneCardsProps = {
  scenes: ScenePlan[];
  images: SceneImageMap;
  warnings: string[];
  shareUrl?: string | null;
  joinCode?: string | null;
  onEnterWorld: () => void;
  onReset: () => void;
};

export function SceneCards({ scenes, images, warnings, shareUrl, joinCode, onEnterWorld, onReset }: SceneCardsProps) {
  const [copied, setCopied] = useState(false);
  const shareOrigin = getShareOrigin(shareUrl);
  const [videoExporting, setVideoExporting] = useState(false);
  const [videoError, setVideoError] = useState("");

  async function copyShareUrl() {
    if (!shareUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  async function downloadVideo() {
    if (videoExporting) {
      return;
    }

    setVideoExporting(true);
    setVideoError("");

    try {
      const blob = await renderSceneVideo(scenes, images);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pageworld-${new Date().toISOString().slice(0, 10)}.webm`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setVideoError(error instanceof Error ? error.message : "Could not export the video.");
    } finally {
      setVideoExporting(false);
    }
  }

  return (
    <section className="min-h-svh bg-[#080a0f] px-5 py-6 text-stone-50 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-7xl flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h1 className="text-3xl font-semibold">Scene chain</h1>
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={onReset} className="border border-white/14 px-4 py-2 text-sm text-stone-200">
              New PDF
            </button>
            <button
              type="button"
              onClick={downloadVideo}
              disabled={videoExporting}
              className="inline-flex items-center gap-2 border border-white/14 px-4 py-2 text-sm text-stone-200 transition hover:border-cyan-200/60 disabled:cursor-wait disabled:opacity-60"
            >
              {videoExporting ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
              {videoExporting ? "Rendering" : "Download video"}
            </button>
            <button
              type="button"
              onClick={onEnterWorld}
              className="inline-flex items-center gap-2 bg-cyan-200 px-5 py-2 text-sm font-semibold text-slate-950"
            >
              <DoorOpen size={17} />
              Enter world
            </button>
          </div>
        </header>

        {warnings.length > 0 ? (
          <div className="mt-4 border border-amber-200/20 bg-amber-200/8 p-3 text-sm leading-6 text-amber-100">
            {warnings.join(" ")}
          </div>
        ) : null}

        {videoError ? (
          <div className="mt-4 border border-amber-200/20 bg-amber-200/8 p-3 text-sm leading-6 text-amber-100">
            {videoError}
          </div>
        ) : null}

        {shareUrl ? (
          <div className="mt-4 flex flex-col gap-4 border border-cyan-200/18 bg-cyan-200/[0.055] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="flex min-h-28 min-w-36 shrink-0 flex-col items-center justify-center border border-cyan-100/24 bg-[#071018] px-4">
                <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-cyan-100/75">
                  <Gamepad2 size={14} />
                  Code
                </p>
                <p className="mt-2 font-mono text-4xl font-bold tracking-[0.16em] text-cyan-100">{joinCode ?? "-----"}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/80">Quest handoff</p>
                <p className="mt-2 text-sm leading-6 text-stone-200">
                  On the Quest, open {shareOrigin ? <span className="break-all font-semibold text-cyan-100">{shareOrigin}</span> : "this app"} and tap Join with code.
                </p>
                <p className="mt-1 break-all text-xs leading-5 text-stone-400">Direct link: {shareUrl}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={copyShareUrl}
              className="inline-flex min-h-11 items-center justify-center gap-2 border border-cyan-100/28 px-4 text-sm font-semibold text-cyan-50 transition hover:border-cyan-100"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        ) : null}

        <div className="grid flex-1 items-stretch gap-4 py-6 lg:grid-cols-3">
          {scenes.map((scene, index) => (
            <article key={scene.id} className="flex min-h-[560px] flex-col border border-white/12 bg-white/[0.035]">
              <div className="relative h-52 overflow-hidden bg-[#111820]">
                {images[scene.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={images[scene.id] ?? ""} alt="" className="h-full w-full object-cover opacity-90" />
                ) : (
                  <div className="flex h-full items-center justify-center text-cyan-100/70">
                    <ImageIcon size={32} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#080a0f] via-transparent to-transparent" />
                <span className="absolute left-4 top-4 bg-black/60 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-100">
                  Scene {index + 1}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h2 className="text-2xl font-semibold">{scene.title}</h2>
                <p className="mt-3 text-sm leading-6 text-stone-300">{scene.summary}</p>
                <dl className="mt-5 grid gap-4 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Layout</dt>
                    <dd className="mt-1 text-stone-200">{humanizeLayout(scene.layoutType)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Dressing</dt>
                    <dd className="mt-1 leading-6 text-stone-300">{scene.dressing}</dd>
                  </div>
                </dl>
                <div className="mt-auto pt-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Interactables</p>
                  <p className="mt-2 text-sm text-stone-300">{scene.objects.map((object) => object.label).join(" · ")}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function getShareOrigin(shareUrl?: string | null): string | null {
  if (!shareUrl) {
    return null;
  }

  try {
    return new URL(shareUrl).origin;
  } catch {
    return null;
  }
}

async function renderSceneVideo(scenes: ScenePlan[], images: SceneImageMap): Promise<Blob> {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("This browser does not support video export.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not prepare the video canvas.");
  }

  if (!("captureStream" in canvas)) {
    throw new Error("This browser cannot record a canvas video.");
  }

  const stream = canvas.captureStream(30);
  const mimeType = getSupportedVideoMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  });

  const stopped = new Promise<void>((resolve, reject) => {
    recorder.addEventListener("stop", () => resolve(), { once: true });
    recorder.addEventListener("error", () => reject(new Error("Video export failed.")), { once: true });
  });

  const loadedImages = await Promise.all(scenes.map((scene) => loadSceneImage(images[scene.id])));

  recorder.start();

  for (let index = 0; index < scenes.length; index += 1) {
    await renderSceneClip(context, scenes[index], loadedImages[index], index, scenes.length);
  }

  recorder.stop();
  stream.getTracks().forEach((track) => track.stop());
  await stopped;

  return new Blob(chunks, { type: recorder.mimeType || "video/webm" });
}

function getSupportedVideoMimeType(): string {
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

function loadSceneImage(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function renderSceneClip(
  context: CanvasRenderingContext2D,
  scene: ScenePlan,
  image: HTMLImageElement | null,
  index: number,
  total: number
): Promise<void> {
  const duration = 2600;
  const startedAt = performance.now();

  return new Promise((resolve) => {
    function frame(now: number) {
      const progress = Math.min(1, (now - startedAt) / duration);
      drawSceneVideoFrame(context, scene, image, index, total, progress);

      if (progress >= 1) {
        resolve();
        return;
      }

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  });
}

function drawSceneVideoFrame(
  context: CanvasRenderingContext2D,
  scene: ScenePlan,
  image: HTMLImageElement | null,
  index: number,
  total: number,
  progress: number
) {
  const width = context.canvas.width;
  const height = context.canvas.height;

  context.fillStyle = "#080a0f";
  context.fillRect(0, 0, width, height);

  if (image) {
    drawImageCover(context, image, 0, 0, width, height);
  } else {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#101923");
    gradient.addColorStop(1, "#17313a");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }

  const overlay = context.createLinearGradient(0, 0, 0, height);
  overlay.addColorStop(0, "rgba(8, 10, 15, 0.18)");
  overlay.addColorStop(0.55, "rgba(8, 10, 15, 0.38)");
  overlay.addColorStop(1, "rgba(8, 10, 15, 0.9)");
  context.fillStyle = overlay;
  context.fillRect(0, 0, width, height);

  context.fillStyle = "rgba(8, 10, 15, 0.72)";
  context.fillRect(64, 424, 760, 206);

  context.fillStyle = "#a5f3fc";
  context.font = "600 22px Arial, sans-serif";
  context.fillText(`Scene ${index + 1} of ${total}`, 96, 470);

  context.fillStyle = "#fafaf9";
  context.font = "700 46px Arial, sans-serif";
  drawWrappedText(context, scene.title, 96, 530, 680, 54, 2);

  context.fillStyle = "#d6d3d1";
  context.font = "400 24px Arial, sans-serif";
  drawWrappedText(context, scene.summary, 96, 584, 680, 34, 2);

  context.fillStyle = "#67e8f9";
  context.fillRect(64, 676, Math.max(2, (width - 128) * progress), 6);
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  let truncated = false;

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;

    if (context.measureText(nextLine).width <= maxWidth || !line) {
      line = nextLine;
      continue;
    }

    lines.push(line);
    line = word;

    if (lines.length === maxLines) {
      truncated = true;
      break;
    }
  }

  if (line && lines.length < maxLines) {
    lines.push(line);
  }

  lines.forEach((currentLine, index) => {
    const clippedLine = truncated && index === maxLines - 1
      ? `${currentLine.replace(/\s+\S+$/, "")}...`
      : currentLine;
    context.fillText(clippedLine, x, y + index * lineHeight);
  });
}

function humanizeLayout(layoutType: ScenePlan["layoutType"]): string {
  const labels: Record<ScenePlan["layoutType"], string> = {
    interior_room: "Interior room",
    open_clearing: "Open clearing",
    corridor_path: "Corridor path",
    exhibit_space: "Exhibit space"
  };

  return labels[layoutType];
}
