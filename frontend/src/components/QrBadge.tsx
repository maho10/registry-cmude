import { QRCodeSVG } from "qrcode.react";
import logoRaw from "../assets/cmude-logo.svg?raw";
import { dietHexColor, type Participant } from "../lib/supabase";

const LOGO_SOURCE_FILL = "#034ea2";

/** Recolors the logo SVG source and returns it as a data URI, ignoring its authored fill. */
function coloredLogoDataUri(color: string): string {
  const recolored = logoRaw.split(LOGO_SOURCE_FILL).join(color);
  return `data:image/svg+xml;utf8,${encodeURIComponent(recolored)}`;
}

/**
 * QR code with the CMUDE logo embedded at its center, both tinted to the
 * participant's diet color. The logo keeps whatever fill it was authored
 * with — we ignore that and swap it for the diet color at render time.
 */
export default function QrBadge({ participant }: { participant: Participant }) {
  const color = dietHexColor(participant.diet_type);
  const url = `${window.location.origin}/p/${participant.id}`;

  return (
    <div className="bg-white rounded-2xl shadow p-4 flex flex-col items-center gap-2 w-full sm:w-56 shrink-0">
      <QRCodeSVG
        value={url}
        size={192}
        fgColor={color}
        bgColor="#ffffff"
        level="H"
        imageSettings={{
          src: coloredLogoDataUri(color),
          height: 40,
          width: 40,
          excavate: true,
        }}
      />
    </div>
  );
}
