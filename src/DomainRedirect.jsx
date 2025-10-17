// src/DomainRedirect.jsx
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Eén project, twee domeinen:
 * - MAIN: workingpoint.nl / www.workingpoint.nl  -> alleen /formulier
 * - APP : app.workingpoint.nl                    -> beheer; root => /startlijst
 * HashRouter-compatibel (leest pad uit window.location.hash).
 */
export default function DomainRedirect() {
  const mounted = useRef(false);
  // useLocation is alleen om te wachten tot Router geladen is
  useLocation();

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    const host = window.location.hostname;
    const hash = window.location.hash || "";     // e.g. "#/startlijst?x=1"
    const isHashMode = hash.startsWith("#/");

    const parseHash = () => {
      const s = hash.slice(1); // "/startlijst?x=1"
      const [p = "/", q = ""] = s.split("?");
      return { path: p || "/", query: q ? `?${q}` : "" };
    };

    const path  = isHashMode ? parseHash().path  : (window.location.pathname || "/");
    const query = isHashMode ? parseHash().query : (window.location.search   || "");

    const MAIN = new Set(["workingpoint.nl", "www.workingpoint.nl"]);
    const APP  = new Set(["app.workingpoint.nl"]);

    const go = (domain, p, q = "") => {
      const base = `https://${domain}`;
      const url  = isHashMode ? `${base}/#${p}${q}` : `${base}${p}${q}`;
      if (window.location.href !== url) window.location.replace(url);
    };

    if (APP.has(host)) {
      // Op app.*: root => /startlijst (intern), /formulier => cross-domain naar main
      if (path === "/") {
        if (hash !== "#/startlijst") window.location.replace("#/startlijst");
        return;
      }
      if (path.startsWith("/formulier")) {
        go("workingpoint.nl", "/formulier", query);
        return;
      }
      return; // alle andere paden blijven op app.*
    }

    if (MAIN.has(host)) {
      // Op main: root => /formulier (intern), alles behalve /formulier => cross naar app.*
      if (path === "/") {
        if (hash !== "#/formulier") window.location.replace("#/formulier");
        return;
      }
      if (!path.startsWith("/formulier")) {
        go("app.workingpoint.nl", path, query);
        return;
      }
    }
  }, []);

  return null;
}
