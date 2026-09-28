import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import { CameraSlash } from "@phosphor-icons/react";

/** Camera QR reader. Calls onResult once per distinct code, with a short cooldown. */
export function Scanner({ onResult, paused }: { onResult: (text: string) => void; paused?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const lastRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const cbRef = useRef(onResult);
  cbRef.current = onResult;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    const scanner = new QrScanner(
      videoRef.current,
      (res) => {
        const now = Date.now();
        if (res.data === lastRef.current.text && now - lastRef.current.at < 10000) return;
        lastRef.current = { text: res.data, at: now };
        cbRef.current(res.data);
      },
      {
        preferredCamera: "environment",
        highlightScanRegion: true,
        highlightCodeOutline: true,
        maxScansPerSecond: 8,
        // Scan most of the frame so a phone held at arm's length still reads.
        calculateScanRegion: (v) => {
          const size = Math.round(Math.min(v.videoWidth, v.videoHeight) * 0.85);
          const down = Math.min(size, 720);
          return {
            x: Math.round((v.videoWidth - size) / 2),
            y: Math.round((v.videoHeight - size) / 2),
            width: size,
            height: size,
            downScaledWidth: down,
            downScaledHeight: down,
          };
        },
      },
    );
    scannerRef.current = scanner;
    scanner.start().catch(() => setError("Camera not available. Allow camera access, or check guests in from the list."));
    return () => {
      scanner.stop();
      scanner.destroy();
      scannerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const s = scannerRef.current;
    if (!s) return;
    if (paused) s.pause();
    else s.start().catch(() => {});
  }, [paused]);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-[#0e1110]">
      <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-[#b3bbb6]">
          <CameraSlash size={32} />
          {error}
        </div>
      )}
    </div>
  );
}
