import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * - Op app.*: root => /startlijst (intern)
 * - Op (www.)workingpoint.nl: root => /formulier (intern)
 */
export default function DomainRedirect() {
  const mounted = useRef(false);
  useLocation();

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    const host = window.location.hostname;
    const hash = window.location.hash || ""; // "#/…"
    const isHashMode = hash.startsWith("#/");

    const parseHash = () => {
      const s = hash.slice(1);
      const [p = "/"] = s.split("?");
      return { path: p || "/" };
    };

    const { path } = isHashMode ? parseHash() : { path: window.location.pathname || "/" };

    const onApp = host === "app.workingpoint.nl";
    const onMain = host === "workingpoint.nl" || host === "www.workingpoint.nl";

    if (onApp && path === "/") {
      if (hash !== "#/startlijst") window.location.replace("#/startlijst");
      return;
    }
    if (onMain && path === "/") {
      if (hash !== "#/formulier") window.location.replace("#/formulier");
      return;
    }
  }, []);

  return null;
}
