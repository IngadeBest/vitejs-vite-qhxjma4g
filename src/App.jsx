import React from "react";
import { HashRouter as Router, Routes, Route, NavLink, Navigate } from "react-router-dom";
import DomainRedirect from "@/DomainRedirect";

// Pagina’s
import PublicInschrijven from "@/features/inschrijven/pages/PublicInschrijven";
import Startlijst from "@/features/startlijst/pages/Startlijst";
import ProtocolGenerator from "@/features/protocollen/pages/ProtocolGenerator";
import Tussenstand from "@/features/uitslag/pages/Tussenstand";
import Einduitslag from "@/features/uitslag/pages/Einduitslag";
import WedstrijdenBeheer from "@/features/wedstrijden/pages/WedstrijdenBeheer";

// --- Route guards: extra slot op elke route ---
const isAppHost = () =>
  typeof window !== "undefined" && window.location.hostname.startsWith("app.");

function OnlyMain({ children }) {
  if (isAppHost()) {
    // iemand probeert formulier op app.* -> cross naar main
    window.location.replace("https://workingpoint.nl/#/formulier");
    return null;
  }
  return children;
}

function OnlyApp({ children }) {
  if (!isAppHost()) {
    // iemand probeert beheer op main -> cross naar app.*
    const hash = typeof window !== "undefined" ? window.location.hash : "#/startlijst";
    const path = hash.startsWith("#/") ? hash.slice(1) : "/startlijst";
    window.location.replace(`https://app.workingpoint.nl/#${path}`);
    return null;
  }
  return children;
}
// ------------------------------------------------

const navStyle = ({ isActive }) => ({
  padding: "8px 10px",
  borderRadius: 8,
  textDecoration: "none",
  color: isActive ? "#fff" : "#2b6cb0",
  background: isActive ? "#2b6cb0" : "transparent",
  fontWeight: 700,
});

export default function App() {
  const onApp = isAppHost();

  return (
    <Router>
      {/* Domein-afhankelijke routering (zachte redirect) */}
      <DomainRedirect />

      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          borderBottom: "1px solid #eee",
          position: "sticky",
          top: 0,
          background: "#fff",
          zIndex: 10,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 18, color: "#102754" }}>Working Point</div>
        <nav style={{ display: "flex", gap: 10, marginLeft: "auto", flexWrap: "wrap" }}>
          {/* Op app.* linkt Inschrijven direct naar main-domein om elke twijfel te voorkomen */}
          {onApp ? (
            <a href="https://workingpoint.nl/#/formulier" style={navStyle({ isActive: false })}>
              Inschrijven
            </a>
          ) : (
            <NavLink to="/formulier" style={navStyle}>
              Inschrijven
            </NavLink>
          )}

          <NavLink to="/startlijst" style={navStyle}>Startlijst</NavLink>
          <NavLink to="/protocollen" style={navStyle}>Protocollen</NavLink>
          <NavLink to="/tussenstand" style={navStyle}>Tussenstand</NavLink>
          <NavLink to="/einduitslag" style={navStyle}>Einduitslag</NavLink>
          <NavLink to="/wedstrijden" style={navStyle}>Wedstrijden</NavLink>
        </nav>
      </header>

      <Routes>
        {/* MAIN-domein (alleen hier renderen) */}
        <Route
          path="/formulier"
          element={
            <OnlyMain>
              <PublicInschrijven />
            </OnlyMain>
          }
        />

        {/* APP-domein (alleen hier renderen) */}
        <Route
          path="/startlijst"
          element={
            <OnlyApp>
              <Startlijst />
            </OnlyApp>
          }
        />
        <Route
          path="/protocollen"
          element={
            <OnlyApp>
              <ProtocolGenerator />
            </OnlyApp>
          }
        />
        <Route
          path="/tussenstand"
          element={
            <OnlyApp>
              <Tussenstand />
            </OnlyApp>
          }
        />
        <Route
          path="/einduitslag"
          element={
            <OnlyApp>
              <Einduitslag />
            </OnlyApp>
          }
        />
        <Route
          path="/wedstrijden"
          element={
            <OnlyApp>
              <WedstrijdenBeheer />
            </OnlyApp>
          }
        />

        {/* Neutrale fallback; DomainRedirect + guards zetten je vanzelf op juiste domein */}
        <Route path="*" element={<Navigate to="/formulier" replace />} />
      </Routes>
    </Router>
  );
}
