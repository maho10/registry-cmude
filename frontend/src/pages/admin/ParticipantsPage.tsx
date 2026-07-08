import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, type Participant, isComplete, lunchField, lunchPhasesForPackage, dietStyle } from "../../lib/supabase";

const API_URL = import.meta.env.VITE_API_URL as string;

export default function ParticipantsPage() {
  const navigate = useNavigate();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [search, setSearch] = useState("");
  const [filterPkg, setFilterPkg] = useState<"" | "full" | "partial">("");
  const [filterStatus, setFilterStatus] = useState<"" | "complete" | "incomplete">("");
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("participants")
      .select("*")
      .order("name");
    if (data) setParticipants(data as Participant[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();

    const channel = supabase
      .channel("participants-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "participants" }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load]);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg("");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(`${API_URL}/api/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const json = await res.json();
      if (res.ok) {
        setImportMsg(`✓ ${json.imported} importados, ${json.skipped} omitidos`);
        load();
      } else {
        setImportMsg(`Error: ${json.detail}`);
      }
    } catch {
      setImportMsg("Error de red al importar");
    }

    setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  const filtered = participants.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterPkg && p.package_type !== filterPkg) return false;
    if (filterStatus === "complete" && !isComplete(p)) return false;
    if (filterStatus === "incomplete" && isComplete(p)) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Participantes</h1>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleImport}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="btn-secondary text-sm"
          >
            {importing ? "Importando…" : "Importar CSV"}
          </button>
        </div>
      </div>

      {importMsg && (
        <p className={`text-sm px-3 py-2 rounded-lg ${importMsg.startsWith("✓") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {importMsg}
        </p>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          placeholder="Buscar por nombre…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input flex-1 min-w-[180px]"
        />
        <select value={filterPkg} onChange={(e) => setFilterPkg(e.target.value as typeof filterPkg)} className="input w-auto">
          <option value="">Todos los paquetes</option>
          <option value="full">Completo</option>
          <option value="partial">Parcial</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)} className="input w-auto">
          <option value="">Todos los estados</option>
          <option value="complete">Completo</option>
          <option value="incomplete">Pendiente</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando…</div>
      ) : (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Nombre</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Paquete</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Dieta</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Cuarto</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Kit</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Almuerzos</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((p) => {
                  const phases = lunchPhasesForPackage(p.package_type);
                  const maxDays = phases.length;
                  const lunchDone = phases.filter((phase) => p[lunchField(phase.day)]).length;
                  const diet = dietStyle(p.diet_type);
                  const complete = isComplete(p);

                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/admin/participants/${p.id}`)}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {p.name}
                        {p.is_minor && (
                          <span className="badge bg-orange-100 text-orange-800 ml-2">Menor</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="badge bg-blue-100 text-blue-800">
                          {p.package_type === "full" ? "Completo" : "Parcial"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {p.diet_type ? (
                          <span className={`badge ${diet.bg} ${diet.text}`}>{diet.label}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{p.room ?? <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-center">
                        {p.arrival_kit ? "✓" : <span className="text-gray-300">○</span>}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-gray-700">
                        {lunchDone}/{maxDays}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {complete ? (
                          <span className="badge bg-green-100 text-green-700">Completo</span>
                        ) : (
                          <span className="badge bg-gray-100 text-gray-500">Pendiente</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                      No hay participantes
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="text-xs text-gray-400 text-right">{filtered.length} de {participants.length} participantes</p>
    </div>
  );
}
