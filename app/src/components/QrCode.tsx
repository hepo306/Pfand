import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Always dark-on-light so phone cameras can read it in both themes. */
export function QrCode({ value, size = 240, label }: { value: string; size?: number; label: string }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#141816", light: "#fdfdfc" },
    }).then(setSrc);
  }, [value, size]);
  return (
    <div className="rounded-2xl bg-[#fdfdfc] p-3" style={{ width: size + 24, height: size + 24 }}>
      {src ? <img src={src} alt={label} width={size} height={size} /> : <div className="shimmer h-full w-full rounded-xl" />}
    </div>
  );
}
