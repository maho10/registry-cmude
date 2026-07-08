import { useEffect, useState } from "react";
import {
  supabase,
  type EventConfig,
  type Participant,
  currentPhase,
  lunchField,
  lunchPhasesForPackage,
} from "../../lib/supabase";

interface Stats {
  total: number;
  arrival_kits: number;
  lunches_today: number;
  complete: number;
  minors: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [config, setConfig] = useState<EventConfig | null>(null);
  const [arrivalDate, setArrivalDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    async function load() {
      const [{ data: participants }, { data: cfg }] = await Promise.all([
        supabase.from("participants").select("*"),
        supabase.from("event_config").select("*").eq("id", 1).single(),
      ]);

      if (cfg) {
        setConfig(cfg as EventConfig);
        setArrivalDate(cfg.arrival_date);
      }

      if (participants) {
        const ps = participants as Participant[];
        const phase = cfg ? currentPhase(cfg.arrival_date as string) : null;
        const todaysField = phase?.hasLunch ? lunchField(phase.day) : null;

        setStats({
          total: ps.length,
          arrival_kits: ps.filter((p) => p.arrival_kit).length,
          lunches_today: todaysField ? ps.filter((p) => p[todaysField]).length : 0,
          complete: ps.filter((p) =>
            lunchPhasesForPackage(p.package_type).every((phase) => p[lunchField(phase.day)])
          ).length,
          minors: ps.filter((p) => p.is_minor).length,
        });
      }
    }
    load();
  }, []);

  async function saveConfig() {
    if (!arrivalDate) return;
    setSaving(true);
    setSaveMsg("");
    const { error } = await supabase
      .from("event_config")
      .upsert({ id: 1, arrival_date: arrivalDate, event_name: config?.event_name ?? "CMUDE" });
    setSaving(false);
    setSaveMsg(error ? "Error al guardar" : "Guardado ✓");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Total participantes" value={stats.total} color="blue" />
          <StatCard label="Kits entregados" value={stats.arrival_kits} color="purple" />
          <StatCard label="Almuerzos hoy" value={stats.lunches_today} color="orange" />
          <StatCard label="Proceso completo" value={stats.complete} color="green" />
          <StatCard label="Menores de edad" value={stats.minors} color="red" />
        </div>
      )}

      {/* Event config */}
      <div className="bg-white rounded-2xl shadow p-5 max-w-sm">
        <h2 className="font-semibold text-gray-800 mb-3">Configuración del evento</h2>
        <label className="block text-sm text-gray-600 mb-1">Fecha de llegada</label>
        <input
          type="date"
          value={arrivalDate}
          onChange={(e) => setArrivalDate(e.target.value)}
          className="input mb-3"
        />
        <button onClick={saveConfig} disabled={saving} className="btn-primary">
          {saving ? "Guardando…" : "Guardar"}
        </button>
        {saveMsg && <p className="text-sm mt-2 text-green-600">{saveMsg}</p>}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
    orange: "bg-orange-50 text-orange-700",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <div className={`rounded-2xl p-4 shadow ${colors[color]}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm mt-1 font-medium">{label}</p>
    </div>
  );
}
