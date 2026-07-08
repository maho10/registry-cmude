import { useEffect, useState } from "react";
import { Outlet, useNavigate, NavLink } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export default function AdminLayout() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate("/admin/login", { replace: true });
      else setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate("/admin/login", { replace: true });
    });

    return () => listener.subscription.unsubscribe();
  }, [navigate]);

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (checking) return null;

  return (
    <div className="min-h-dvh flex flex-col bg-gray-50">
      <nav className="bg-blue-700 text-white px-4 py-3 flex items-center justify-between shadow">
        <div className="flex items-center gap-4">
          <span className="font-bold text-lg">CMUDE</span>
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) =>
              `text-sm px-3 py-1 rounded-lg ${isActive ? "bg-white/20" : "hover:bg-white/10"}`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/admin/participants"
            className={({ isActive }) =>
              `text-sm px-3 py-1 rounded-lg ${isActive ? "bg-white/20" : "hover:bg-white/10"}`
            }
          >
            Participantes
          </NavLink>
        </div>
        <button onClick={signOut} className="text-sm hover:text-white/70">
          Salir
        </button>
      </nav>
      <main className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
