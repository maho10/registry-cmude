import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  supabase,
  type Participant,
  type ScanMode,
  evaluateScan,
  dietStyle,
} from "../lib/supabase";

/**
 * Public scan-result screen. Shows ONLY the diet type plus a big
 * granted/denied indicator — no name, no room, no other participant data.
 * The scan itself grants (writes to the DB) when eligible; see evaluateScan.
 */
export default function ParticipantPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mode: ScanMode = searchParams.get("mode") === "kit" ? "kit" : "lunch";

  const [status, setStatus] = useState<"loading" | "not_found" | "granted" | "denied">("loading");
  const [dietType, setDietType] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (!id || handled.current) return;
    handled.current = true;

    async function run() {
      const [{ data: p, error: pErr }, { data: cfg }] = await Promise.all([
        supabase.from("participants").select("*").eq("id", id).single(),
        supabase.from("event_config").select("*").eq("id", 1).single(),
      ]);

      if (pErr || !p || !cfg) {
        setStatus("not_found");
        return;
      }

      const participant = p as Participant;
      setDietType(participant.diet_type);

      const result = evaluateScan(mode, participant, cfg.arrival_date as string);

      if (result.granted && result.field) {
        await supabase
          .from("participants")
          .update({ [result.field]: true, [`${result.field}_at`]: new Date().toISOString() })
          .eq("id", id);
      }

      setStatus(result.granted ? "granted" : "denied");
    }

    run();
  }, [id, mode]);

  if (status === "loading") {
    return (
      <FullScreen className="bg-gray-900">
        <Spinner />
      </FullScreen>
    );
  }

  if (status === "not_found") {
    return (
      <FullScreen className="bg-gray-900">
        <div className="text-center space-y-4">
          <p className="text-2xl font-bold text-white">QR no encontrado</p>
          <button onClick={() => navigate("/scan")} className="btn-primary">
            Volver a escanear
          </button>
        </div>
      </FullScreen>
    );
  }

  const granted = status === "granted";
  const diet = dietStyle(dietType);

  return (
    <FullScreen className={granted ? "bg-green-600" : "bg-red-600"}>
      <div className="flex flex-col items-center gap-6 text-white text-center px-6">
        <span className={`text-2xl font-bold px-4 py-2 rounded-xl bg-white ${diet.text}`}>
          {diet.label}
        </span>
        <span className="text-[10rem] leading-none font-black drop-shadow">
          {granted ? "✓" : "✗"}
        </span>
        <button
          onClick={() => navigate("/scan")}
          className="bg-white/20 hover:bg-white/30 px-6 py-3 rounded-xl text-lg font-semibold backdrop-blur"
        >
          Escanear otro
        </button>
      </div>
    </FullScreen>
  );
}

function FullScreen({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`min-h-dvh flex items-center justify-center ${className}`}>
      {children}
    </div>
  );
}

function Spinner() {
  return <div className="w-10 h-10 border-4 border-white/60 border-t-transparent rounded-full animate-spin" />;
}
