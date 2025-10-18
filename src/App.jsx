import React from "react";
import { HashRouter as Router, Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import DomainRedirect from "@/DomainRedirect";

// Pagina's
import PublicInschrijven from "@/features/inschrijven/pages/PublicInschrijven";
import InschrijfFormulier from "@/features/inschrijven/pages/InschrijfFormulier";
import Startlijst from "@/features/startlijst/pages/Startlijst";
import ProtocolGenerator from "@/features/protocollen/pages/ProtocolGenerator";
import Einduitslag from "@/features/einduitslag/pages/Einduitslag";
import Contact from "@/features/public/pages/Contact";
import WedstrijdenBeheer from "@/features/wedstrijden/pages/WedstrijdenBeheer";

const navStyle = ({ isActive }) => ({
  padding: "8px 10px",
  borderRadius: 8,
  textDecoration: "none",
  color: isActive ? "#fff" : "#2b6cb0",
  background: isActive ? "#2b6cb0" : "transparent",
  fontWeight: 700,
});

function InnerApp() {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const defaultOnApp = host.startsWith("app.");

  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const menuOverride = params.get("menu"); // allow ?menu=public or ?menu=beheer

  let onApp = defaultOnApp;
  if (menuOverride === "public") onApp = false;
  if (menuOverride === "beheer" || menuOverride === "admin") onApp = true;

  return (
    <>
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
        <div style={{ fontWeight: 800, fontSize: 18, color: "#102754" }}>
          Working Point
        </div>

        <nav style={{ display: "flex", gap: 10, marginLeft: "auto", flexWrap: "wrap" }}>
          {onApp ? (
            <>
              {/* Beheer op app.*: alle onderdelen tonen */}
              <NavLink to="/startlijst" style={navStyle}>Startlijst</NavLink>
              <NavLink to="/protocollen" style={navStyle}>Protocollen</NavLink>
              <NavLink to="/uitslagen" style={navStyle}>Uitslagen</NavLink>
              <NavLink to="/wedstrijden" style={navStyle}>Wedstrijden</NavLink>
              <a href="https://workingpoint.nl/#/contact" style={navStyle({ isActive: false })}>
                Contact
              </a>
            </>
          ) : (
            <>
              {/* Publiek op MAIN: géén "Beheer" knop zichtbaar */}
              <NavLink to="/formulier" style={navStyle}>Inschrijven</NavLink>
              <NavLink to="/contact" style={navStyle}>Contact</NavLink>
            </>
          )}
        </nav>
      </header>

      <Routes>
        {/* Publiek */}
        <Route path="/formulier" element={onApp ? <InschrijfFormulier /> : <PublicInschrijven />} />
        <Route path="/contact" element={<Contact />} />

  {/* Beheer */}
  <Route path="/startlijst" element={<Startlijst />} />
  <Route path="/protocollen" element={<ProtocolGenerator />} />
  <Route path="/uitslagen" element={<Einduitslag />} />
  <Route path="/wedstrijden" element={<WedstrijdenBeheer />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/formulier" replace />} />
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
