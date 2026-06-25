import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function HostRedirect() {
  const nav = useNavigate();
  useEffect(() => {
    const host = window.location.hostname;
    const target = host.startsWith("app.")
      ? "/"           // app landing met wedstrijdkeuze
      : "/formulier"; // ruiterformulier
    nav(target, { replace: true });
  }, [nav]);
  return null; // niets tonen; we redirecten meteen
}
