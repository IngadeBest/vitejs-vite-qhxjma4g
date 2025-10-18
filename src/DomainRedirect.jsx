import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Domeinscheiding:
 * MAIN  = workingpoint.nl / www.workingpoint.nl  -> publiek: /formulier & /contact
 * APP   = app.workingpoint.nl                    -> beheer: /startlijst, /protocollen, /uitslagen
 *
 * Werkt met HashRouter (leest pad uit window.location.hash).
 * - Op MAIN: root => /formulier, alles behalve /formulier|/contact => door naar APP
 * - Op APP : root => /startlijst, /contact => door naar MAIN (wijziging: /formulier blijft op app.* voor beheer)
 */
export default function DomainRedirect() {
  const mounted = useRef(false);
  useLocation(); // wacht tot Router gemount is

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    const host = window.location.hostname;
    const hash = window.location.hash || ""; // e.g. "#/startlijst?x=1"
    const isHash = hash.startsWith("#/");

    const parseHash = () => {
      const s = hash.slice(1); // "/startlijst?x=1"
      const [p = "/", q = ""] = s.split("?");
      return { path: p || "/", query: q ? `?${q}` : "" };
    };

    const { path, query } = isHash
      ? parseHash()
      : { path: window.location.pathname || "/", query: window.location.search || "" };

    const MAIN = new Set(["workingpoint.nl", "www.workingpoint.nl"]);
    const APP  = new Set(["app.workingpoint.nl"]);

    const go = (domain, p, q = "") => {
      const base = `https://${domain}`;
      const url  = isHash ? `${base}/#${p}${q}` : `${base}${p}${q}`;
      if (window.location.href !== url) window.location.replace(url);
    };

    if (APP.has(host)) {
      // Op app.*: root => /startlijst; /contact => naar MAIN
      // Let op: /formulier blijft op app.* zodat beheer de InschrijfFormulier kan tonen.
      if (path === "/") {
        if (hash !== "#/startlijst") window.location.replace("#/startlijst");
        return;
      }
      if (path.startsWith("/contact")) {
        go("workingpoint.nl", path, query);
        return;
      }
      return; // alle andere paden blijven op app.*
    }

    if (MAIN.has(host)) {
      // Op main: root => /formulier; alles behalve /formulier|/contact => naar APP
      if (path === "/") {
        if (hash !== "#/formulier") window.location.replace("#/formulier");
        return;
      }
      const allowed = path.startsWith("/formulier") || path.startsWith("/contact");
      if (!allowed) {
        go("app.workingpoint.nl", path, query);
        return;
      }
    }
  }, []);

  return null;
}
