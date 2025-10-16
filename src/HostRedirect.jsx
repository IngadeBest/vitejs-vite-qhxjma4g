import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function HostRedirect() {
  const nav = useNavigate();
  useEffect(() => {
    const host = window.location.hostname;
    // Pas onderstaande paden evt. aan jouw routes aan:
    const target = host.startsWith("app.")
      ? "/startlijst"   // beheer landing
      : "/formulier";   // ruiterformulier
    nav(target, { replace: true });
  }, [nav]);
  return null; // niets tonen; we redirecten meteen
}
