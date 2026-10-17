import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function Qr({ texto, tamano = 180, className = "" }: { texto: string; tamano?: number; className?: string }) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    let vivo = true;
    QRCode.toDataURL(texto, { width: tamano * 2, margin: 1, errorCorrectionLevel: "M", color: { dark: "#134e4a", light: "#ffffff" } })
      .then((u) => vivo && setUrl(u))
      .catch(() => vivo && setUrl(""));
    return () => {
      vivo = false;
    };
  }, [texto, tamano]);
  if (!url) return <div className={`animate-pulse rounded-lg bg-neutro-200 ${className}`} style={{ width: tamano, height: tamano }} />;
  return <img src={url} width={tamano} height={tamano} alt="Código QR" className={`rounded-lg ${className}`} />;
}
