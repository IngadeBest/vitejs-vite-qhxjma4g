// src/DomainRedirect.jsx
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function DomainRedirect() {
  const nav = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const isApp = window.location.hostname.startsWith("app.");

    const atRoot   = pathname === "/";
    const atForm   = pathname.startsWith("/formulier");
    const atBeheer = pathname.startsWith("/startlijst");

    if (isApp && (atRoot || atForm)) {
      nav("/startlijst", { replace: true });   // beheer op app.*
    } else if (!isApp && (atRoot || atBeheer)) {
      nav("/formulier", { replace: true });    // formulier op hoofddomein
    }
  }, [pathname, nav]);

  return null;
}
