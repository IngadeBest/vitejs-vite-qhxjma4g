import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { isAppHost } from "@/lib/isAppHost";

export default function DomainRedirect() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Als iemand tóch /formulier opent op app.workingpoint.nl: stuur naar main domein
    if (isAppHost() && pathname.startsWith("/formulier")) {
      const hash = pathname + window.location.search + window.location.hash;
      window.location.replace(`https://workingpoint.nl/#${hash}`);
    }
  }, [pathname]);

  return null;
}
