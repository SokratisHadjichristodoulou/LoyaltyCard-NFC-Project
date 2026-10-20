"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { codeFromScan } from "@/lib/coupon-code";

type Labels = { start: string; stop: string; scanning: string; denied: string; unsupported: string };
type Status = "idle" | "starting" | "scanning" | "denied" | "unsupported";

// Not in TypeScript's DOM types yet.
type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => Detector;
  }
}

export function QrScanner({ labels }: { labels: Labels }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  const stop = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStatus((s) => (s === "scanning" || s === "starting" ? "idle" : s));
  }, []);

  useEffect(() => stop, [stop]);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) return setStatus("unsupported");
    setStatus("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setStatus("scanning");
      scanLoop(video);
    } catch (err) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      setStatus(err instanceof DOMException && err.name === "NotAllowedError" ? "denied" : "unsupported");
    }
  }

  async function scanLoop(video: HTMLVideoElement) {
    const detector = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
    const jsQR = detector ? null : (await import("jsqr")).default;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const tick = async () => {
      if (!streamRef.current) return;
      let text: string | null = null;
      if (video.readyState >= 2) {
        if (detector) {
          text = (await detector.detect(video).catch(() => []))[0]?.rawValue ?? null;
        } else if (jsQR && ctx) {
          const scale = Math.min(1, 640 / video.videoWidth);
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          text = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })?.data ?? null;
        }
      }
      const code = text ? codeFromScan(text) : null;
      if (code) {
        stop();
        router.push(`/staff?code=${encodeURIComponent(code)}`);
        return;
      }
      timerRef.current = window.setTimeout(tick, 150);
    };
    tick();
  }

  const live = status === "scanning" || status === "starting";
  const message =
    status === "scanning" ? labels.scanning : status === "denied" ? labels.denied : status === "unsupported" ? labels.unsupported : "";

  return (
    <div className="grid gap-4">
      <div
        className={`relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-[1.75rem] bg-espresso ${live ? "" : "hidden"}`}
      >
        <video ref={videoRef} muted playsInline className="size-full object-cover" />
        <span aria-hidden className="absolute inset-[18%] rounded-2xl border-[3px] border-gold-light/90 shadow-[0_0_0_999px_rgb(58_22_9/0.35)]" />
      </div>
      <p aria-live="polite" className={`text-center text-sm ${status === "denied" || status === "unsupported" ? "text-berry" : "text-roast"}`}>
        {message}
      </p>
      <button
        type="button"
        onClick={live ? stop : start}
        className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-espresso px-7 text-base font-semibold text-gold-light ring-1 ring-gold/50 ring-inset active:scale-[0.98]"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
          <path d="M8 12h8" />
        </svg>
        {live ? labels.stop : labels.start}
      </button>
    </div>
  );
}
