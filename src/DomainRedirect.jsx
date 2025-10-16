// src/DomainRedirect.jsx
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Domeinregels:
 * - MAIN (workingpoint.nl / www.workingpoint.nl): alleen /formulier
 * - APP  (app.workingpoint.nl): alle beheer-routes; root => /startlijst
 *
 * Werkt met HashRouter én BrowserRouter.
 */
export default function DomainRedirect() {
  const nav = useNavigate();
  const { pathname, search } = useLocation();

  useEffect(() => {
    const host = window.location.hostname;
    const isHashMode = window.location.hash?.startsWith("#/");
    const path = pathname || "/";
    const query = search || "";

    const MAIN_DOMAINS = new Set(["workingpoint.nl", "www.workingpoint.nl"]);
    const APP_DOMAINS  = new Set(["app.workingpoint.nl"]);

    const buildUrl = (domain, targetPath, targetQuery = "") => {
      const base = `https://${domain}`;
      return isHashMode ? `${base}/#${targetPath}${targetQuery}` : `${base}${targetPath}${targetQuery}`;
    };

    // APP: root => /startlijst (intern), /formulier => cross naar MAIN
    if (APP_DOMAINS.has(host)) {
      if (path === "/") {
        nav("/startlijst", { replace: true });
        return;
      }
      if (path.startsWith("/formulier")) {
        window.location.replace(buildUrl("workingpoint.nl", "/formulier", query));
        return;
      }
      return;
    }

    // MAIN: root => /formulier (intern), anders cross naar APP
    if (MAIN_DOMAINS.has(host)) {
      if (path === "/") {
        nav("/formulier", { replace: true });
        return;
      }
      if (!path.startsWith("/formulier")) {
        window.location.replace(buildUrl("app.workingpoint.nl", path, query));
        return;
      }
      return;
    }
  }, [pathname, search, nav]);

  return null;
}
