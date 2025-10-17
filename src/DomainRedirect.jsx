import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Eén project, twee domeinen:
 * - MAIN: workingpoint.nl / www.workingpoint.nl  -> alleen /formulier
 * - APP : app.workingpoint.nl                    -> beheer; root => /startlijst
 */
export default function DomainRedirect() {
  const nav = useNavigate();
  const { pathname, search } = useLocation();

  useEffect(() => {
    const host = window.location.hostname;
    const path = pathname || "/";
    const query = search || "";
    const isHash = window.location.hash?.startsWith("#/");

    const MAIN = new Set(["workingpoint.nl", "www.workingpoint.nl"]);
    const APP  = new Set(["app.workingpoint.nl"]);

    const url = (domain, p, q = "") => {
      const base = `https://${domain}`;
      return isHash ? `${base}/#${p}${q}` : `${base}${p}${q}`;
    };

    if (APP.has(host)) {
      // Op app.*: root => /startlijst (intern), /formulier => cross naar main
      if (path === "/") {
        if (isHash ? window.location.hash !== "#/startlijst" : true) {
          nav("/startlijst", { replace: true });
        }
        return;
      }
      if (path.startsWith("/formulier")) {
        const target = url("workingpoint.nl", "/formulier", query);
        if (window.location.href !== target) window.location.replace(target);
        return;
      }
      return;
    }

    if (MAIN.has(host)) {
      // Op main: root => /formulier (intern), andere paden => cross naar app.*
      if (path === "/") {
        if (isHash ? window.location.hash !== "#/formulier" : true) {
          nav("/formulier", { replace: true });
        }
        return;
      }
      if (!path.startsWith("/formulier")) {
        const target = url("app.workingpoint.nl", path, query);
        if (window.location.href !== target) window.location.replace(target);
        return;
      }
    }
  }, [pathname, search, nav]);

  return null;
}
