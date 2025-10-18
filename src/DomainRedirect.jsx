import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Eén project, twee domeinen:
 * - MAIN: workingpoint.nl / www.workingpoint.nl  -> publiek: /formulier, /contact
 * - APP : app.workingpoint.nl                    -> beheer:  /startlijst (en evt. andere beheer-routes)
 * HashRouter-compatibel: leest uit window.location.hash.
 */
export default function DomainRedirect() {
  const mounted = useRef(false);
  useLocation(); // wacht tot Router init is

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    const host = window.location.hostname;
    const hash = window.location.hash || ""; // e.g. "#/startlijst?x=1"
    const isHashMode = hash.startsWith("#/");

    const parseHash = () => {
      const s = hash.slice(1); // "/pad?query"
      const [p = "/", q = ""] = s.split("?");
      return { path: p || "/", query: q ? `?${q}` : "" };
    };

    const { path, query } = isHashMode
      ? parseHash()
      : { path: window.location.pathname || "/", query: window.location.search || "" };

    const MAIN = new Set(["workingpoint.nl", "www.workingpoint.nl"]);
    const APP  = new Set(["app.workingpoint.nl"]);

    const go = (domain, p, q = "") => {
      const base = `https://${domain}`;
      const url  = isHashMode ? `${base}/#${p}${q}` : `${base}${p}${q}`;
      if (window.location.href !== url) window.location.replace(url);
    };

    if (APP.has(host)) {
      // Op app.*: root => /startlijst (intern)
      if (path === "/") {
        if (hash !== "#/startlijst") window.location.replace("#/startlijst");
        return;
      }
      // Publieke paden horen op main-domein
      if (path.startsWith("/formulier") || path.startsWith("/contact")) {
        go("workingpoint.nl", path, query);
        return;
      }
      return; // overige beheer-paden blijven op app.*
    }

    if (MAIN.has(host)) {
      // Op main: root => /formulier (intern)
      if (path === "/") {
        if (hash !== "#/formulier") window.location.replace("#/formulier");
        return;
      }
      // Beheer-paden horen op app-domein
      if (path.startsWith("/startlijst") || path.startsWith("/protocollen") || path.startsWith("/uitslagen")) {
        go("app.workingpoint.nl", path, query);
        return;
      }
      return; // /formulier en /contact blijven op main
    }
  }, []);

  return null;
}
