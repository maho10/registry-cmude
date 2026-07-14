import { QRCodeSVG } from "qrcode.react";
import logoUrl from "../assets/cmude-logo.svg?url";
import { dietHexColor, type Participant } from "../lib/supabase";

/**
 * QR code + brand logo, both tinted to the participant's diet color.
 * The logo keeps whatever fill it was authored with — we ignore that and
 * recolor it with a CSS mask so it always matches the QR color.
 */
export default function QrBadge({ participant }: { participant: Participant }) {
  const color = dietHexColor(participant.diet_type);
  const url = `${window.location.origin}/p/${participant.id}`;

  return (
    <div className="bg-white rounded-2xl shadow p-4 flex flex-col items-center gap-3 w-full sm:w-56 shrink-0">
      <QRCodeSVG value={url} size={176} fgColor={color} bgColor="#ffffff" level="M" />
      <div
        aria-hidden
        className="w-16 h-16"
        style={{
          backgroundColor: color,
          WebkitMaskImage: `url(${logoUrl})`,
          maskImage: `url(${logoUrl})`,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskSize: "contain",
          maskSize: "contain",
          WebkitMaskPosition: "center",
          maskPosition: "center",
        }}
      />
    </div>
  );
}
