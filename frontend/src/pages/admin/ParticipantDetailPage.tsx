import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  supabase,
  type Participant,
  lunchField,
  lunchPhasesForPackage,
  isComplete,
  dietStyle,
} from "../../lib/supabase";
import QrBadge from "../../components/QrBadge";

export default function ParticipantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("participants").select("*").eq("id", id).single();
    if (data) setParticipant(data as Participant);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(field: string, currentValue: boolean) {
    if (!id) return;
    setUpdating(field);
    await supabase
      .from("participants")
      .update({ [field]: !currentValue, [`${field}_at`]: !currentValue ? new Date().toISOString() : null })
      .eq("id", id);
    await load();
    setUpdating(null);
  }

  if (loading) return <p className="text-gray-400">Cargando…</p>;
  if (!participant) return <p className="text-gray-400">Participante no encontrado</p>;

  const p = participant;
  const diet = dietStyle(p.diet_type);
  const lunchPhases = lunchPhasesForPackage(p.package_type);
  const complete = isComplete(p);

  return (
    <div className="space-y-4 max-w-2xl">
      <button onClick={() => navigate(-1)} className="text-blue-600 text-sm">
        ← Volver
      </button>

      <div className="flex flex-col sm:flex-row gap-4">
        <QrBadge participant={p} />
        <div className="bg-white rounded-2xl shadow p-5 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{p.name}</h1>
            {complete && <span className="badge bg-green-100 text-green-700">Completo</span>}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="badge bg-blue-100 text-blue-800">
              Paquete {p.package_type === "full" ? "completo" : "parcial"}
            </span>
            {p.role && <span className="badge bg-gray-100 text-gray-700">{p.role}</span>}
            {p.diet_type && <span className={`badge ${diet.bg} ${diet.text}`}>{diet.label}</span>}
            {p.is_minor && <span className="badge bg-orange-100 text-orange-800">Menor de edad</span>}
            {p.room && <span className="badge bg-gray-100 text-gray-700">Cuarto {p.room}</span>}
          </div>
          {p.food_restrictions && (
            <p className="mt-3 text-sm text-red-700 font-medium bg-red-50 rounded-lg px-3 py-2">
              ⚠️ {p.food_restrictions}
            </p>
          )}
        </div>
      </div>

      <Section title="Kit de llegada">
        <CheckRow
          label="Welcome Kit + Gafete"
          checked={p.arrival_kit}
          loading={updating === "arrival_kit"}
          onToggle={() => toggle("arrival_kit", p.arrival_kit)}
        />
      </Section>

      <Section title="Almuerzos">
        {lunchPhases.map((phase) => {
          const field = lunchField(phase.day) as string;
          const checked = p[lunchField(phase.day)] as boolean;
          return (
            <CheckRow
              key={phase.day}
              label={phase.label}
              checked={checked}
              loading={updating === field}
              onToggle={() => toggle(field, checked)}
            />
          );
        })}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">{title}</h2>
      <div className="bg-white rounded-2xl shadow divide-y divide-gray-100">{children}</div>
    </div>
  );
}

function CheckRow({
  label,
  checked,
  loading = false,
  onToggle,
}: {
  label: string;
  checked: boolean;
  loading?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={loading}
      className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors
        ${checked ? "bg-green-50" : "hover:bg-gray-50"}
        first:rounded-t-2xl last:rounded-b-2xl disabled:cursor-default`}
    >
      <span className={`font-medium ${checked ? "text-green-700" : "text-gray-800"}`}>{label}</span>
      {loading ? (
        <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      ) : checked ? (
        <span className="text-green-500 text-xl">✓</span>
      ) : (
        <span className="w-6 h-6 rounded-full border-2 border-gray-300" />
      )}
    </button>
  );
}
