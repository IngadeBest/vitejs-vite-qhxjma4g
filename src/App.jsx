import React from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
} from "react-router-dom";
import DomainRedirect from "@/DomainRedirect";

// Pagina's
import PublicInschrijven from "@/features/inschrijven/pages/PublicInschrijven";
import InschrijfFormulier from "@/features/inschrijven/pages/InschrijfFormulier";
import Startlijst from "@/features/startlijst/pages/Startlijst";
import Deelnemers from "@/features/deelnemers/pages/Deelnemers";
import ProtocolGenerator from "@/features/protocollen/pages/ProtocolGenerator";
import Einduitslag from "@/features/einduitslag/pages/Einduitslag";
import Contact from "@/features/public/pages/Contact";
import WedstrijdenBeheer from "@/features/wedstrijden/pages/WedstrijdenBeheer";
import ScoreInvoer from "@/features/scoring/pages/ScoreInvoer";
import Tussenstand from "@/features/uitslag/pages/Tussenstand";

const navStyle = ({ isActive }) => ({
  padding: "8px 10px",
  borderRadius: 8,
  textDecoration: "none",
  color: isActive ? "#fff" : "#2b6cb0",
  background: isActive ? "#2b6cb0" : "transparent",
  fontWeight: 700,
});

function InnerApp() {
  const host =
    typeof window !== "undefined" ? window.location.hostname : "";
  const defaultOnApp = host.startsWith("app.");

  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const menuOverride = params.get("menu"); // allow ?menu=public or ?menu=beheer

  const onApp =
    menuOverride === "public"
      ? false
      : menuOverride === "beheer"
      ? true
      : defaultOnApp;

  // Domein-redirect logica
  if (!onApp) {
    const shouldRedirect =
      host === "workingpoint.nl" || host === "www.workingpoint.nl";
    if (shouldRedirect) {
      return <DomainRedirect />;
    }
  }

  return (
    <>
      <header
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          padding: "10px 16px",
          borderBottom: "1px solid #e2e8f0",
          position: "sticky",
          top: 0,
          background: "#fff",
          zIndex: 10,
        }}
      >
        <div
          style={{ fontWeight: 800, fontSize: 18, color: "#102754" }}
        >
          Working Point
        </div>

        <nav
          style={{
            display: "flex",
            gap: 10,
            marginLeft: "auto",
            flexWrap: "wrap",
          }}
        >
          {onApp ? (
            <>
              {/* Beheer op app.*: toon Wedstrijden als start en volgorde aanpassen */}
              <NavLink
                to="/wedstrijden"
                style={navStyle}
              >
                Wedstrijden
              </NavLink>
              <NavLink
                to="/startlijst"
                style={navStyle}
              >
                Startlijst
              </NavLink>
              <NavLink
                to="/deelnemers"
                style={navStyle}
              >
                Deelnemers
              </NavLink>
              <NavLink
                to="/protocollen"
                style={navStyle}
              >
                Protocollen
              </NavLink>
              <NavLink
                to="/scores"
                style={navStyle}
              >
                Scores
              </NavLink>
              <NavLink
                to="/tussenstand"
                style={navStyle}
              >
                Tussenstand
              </NavLink>
              <NavLink
                to="/uitslagen"
                style={navStyle}
              >
                Einduitslag
              </NavLink>
            </>
          ) : (
            <>
              {/* Publiek op MAIN: géén "Beheer" knop zichtbaar */}
              <NavLink
                to="/formulier"
                style={navStyle}
              >
                Inschrijven
              </NavLink>
              <NavLink
                to="/contact"
                style={navStyle}
              >
                Contact
              </NavLink>
            </>
          )}
        </nav>
      </header>

      <Routes>
        {/* Publiek */}
        <Route
          path="/formulier"
          element={
            onApp ? (
              <InschrijfFormulier />
            ) : (
              <PublicInschrijven />
            )
          }
        />
        <Route path="/contact" element={<Contact />} />

        {/* Beheer */}
        <Route path="/startlijst" element={<Startlijst />} />
        <Route path="/deelnemers" element={<Deelnemers />} />
        <Route
          path="/protocollen"
          element={<ProtocolGenerator />}
        />
        <Route path="/scores" element={<ScoreInvoer />} />
        <Route
          path="/tussenstand"
          element={<Tussenstand />}
        />
        <Route
          path="/uitslagen"
          element={<Einduitslag />}
        />
        <Route
          path="/wedstrijden"
          element={<WedstrijdenBeheer />}
        />

        {/* Fallback: on app.* default to wedstrijden, else formulier */}
        <Route
          path="*"
          element={
            <Navigate
              to={onApp ? "/wedstrijden" : "/formulier"}
              replace
            />
          }
        />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <Router>
      <InnerApp />
    </Router>
  );
}
