import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";

/**
 * Gates /scan and /p/:id behind a signed-in Supabase session (admin or
 * scanner role). This matters for /p/:id specifically: the physical QR
 * codes link straight there, so anyone scanning one with their own phone
 * camera (bypassing our /scan screen) would otherwise land on a page that
 * grants kit/lunch immediately — RLS now blocks that for signed-out devices.
 */
export default function RequireScanAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthenticated(!!data.session);
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(!!session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (checking) return null;

  if (!authenticated) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/scan/login?next=${next}`} replace />;
  }

  return <>{children}</>;
}
