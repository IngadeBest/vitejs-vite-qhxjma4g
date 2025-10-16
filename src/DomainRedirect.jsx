// src/DomainRedirect.jsx
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Domeinregels:
 * - MAIN (workingpoint.nl / www.workingpoint.nl) => alleen /formulier
 * - APP  (app.workingpoint.nl)                  => alles behalve /formulier
 *
 * Werkt met HashRouter en BrowserRouter:
 * - HashRouter: URL is .../#/pad; we sturen dan ook naar .../#/pad
 * - BrowserRouter: URL is .../pad
 */
export default function DomainRedirect() {
  const nav = useNavigate();
  const { pathname, search } = useLocation();

  useEffect(() => {
    const host = window.location.hostname;
    const isHashMode = window.location.hash?.startsWith("#/");
    const path = pathname || "/"; // '/formulier', '/startlijst', etc.
    const query = search || "";

    // Stel jouw domeinen hier in:
    const MAIN_DOMAINS = new Set(["workingpoint.nl", "www.workingpoint.nl"]);
    const APP_DOMAINS  = new Set(["app.workingpoint.nl"]);

    // Hulpfunctie om cross-domain URL te bouwen
    const buildUrl = (domain, targetPath, targetQuery = "") => {
      const base = `https://${domain}`;
      if (isHashMode) {
        // HashRouter: https://domain/#/pad?query
        return `${base}/#${targetPath}${targetQuery}`;
      }
      // BrowserRouter: https://domain/pad?query
      return `${base}${targetPath}${targetQuery}`;
    };

    // 1) Op APP-domein
    if (APP_DOMAINS.has(host)) {
      // Op app.* mag je NIET op het formulier landen -> stuur naar startlijst
      if (path === "/" || path.startsWith("/formulier")) {
        // Cross-domain naar MAIN /formulier
        const to = buildUrl("workingpoint.nl", "/formulier", query);
        window.location.replace(to);
        return;
      }
      // Alle andere paden zijn prima op app.*
      return;
    }

    // 2) Op MAIN-domein
    if (MAIN_DOMAINS.has(host)) {
      // Root -> naar /formulier (zelfde domein, geen cross)
      if (path === "/") {
        nav("/formulier", { replace: true });
        return;
      }
      // Alles wat geen /formulier is -> cross-domain naar app.*
      if (!path.startsWith("/formulier")) {
        const to = buildUrl("app.workingpoint.nl", path, query);
        window.location.replace(to);
        return;
      }
      // /formulier is ok op MAIN
      return;
    }

    // 3) Onbekend domein: niets doen
  }, [pathname, search, nav]);

  return null;
}
