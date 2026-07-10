import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { scanLogin } from "../lib/scanAuth";

export default function ScanLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const ok = await scanLogin(username, password);
    setLoading(false);
    if (ok) {
      const next = searchParams.get("next") || "/scan";
      navigate(next, { replace: true });
    } else {
      setError("Usuario o contraseña incorrectos");
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-900 p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow p-6 w-full max-w-sm space-y-4">
        <h1 className="text-xl font-bold text-gray-900 text-center">Acceso de escaneo</h1>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Usuario</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input"
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            autoComplete="current-password"
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Verificando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
