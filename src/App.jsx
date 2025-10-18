import React from "react";
import { HashRouter as Router, Routes, Route, NavLink, Navigate } from "react-router-dom";
import DomainRedirect from "@/DomainRedirect";

// Pagina's
import PublicInschrijven from "@/features/inschrijven/pages/PublicInschrijven";
import Startlijst from "@/features/startlijst/pages/Startlijst";
import Contact from "@/features/public/pages/Contact"; // nieuw

const navStyle = ({ isActive }) => ({
  padding: "8px 10px",
  borderRadius: 8,
  textDecoration: "none",
  color: isActive ? "#fff" : "#2b6cb0",
  background: isActive ? "#2b6cb0" : "transparent",
  fontWeight: 700,
});

export default function App() {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const onApp  = host.startsWith("app.");

  return (
    <Router>
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
              {/* Op APP linken we extern naar MAIN voor publiek */}
              <a href="https://workingpoint.nl/#/formulier" style={navStyle({ isActive: false })}>
                Inschrijven
              </a>
              <a href="https://workingpoint.nl/#/contact" style={navStyle({ isActive: false })}>
                Contact
              </a>
              {/* Beheer-functies intern */}
              <NavLink to="/startlijst" style={navStyle}>Startlijst</NavLink>
              {/* Voeg later toe als de pagina's klaar zijn:
                  <NavLink to="/protocollen" style={navStyle}>Protocollen</NavLink>
                  <NavLink to="/uitslagen" style={navStyle}>Uitslagen</NavLink>
              */}
            </>
          ) : (
            <>
              {/* Op MAIN alles intern */}
              <NavLink to="/formulier" style={navStyle}>Inschrijven</NavLink>
              <NavLink to="/contact" style={navStyle}>Contact</NavLink>
              {/* Link naar beheer */}
              <a href="https://app.workingpoint.nl/#/startlijst" style={navStyle({ isActive: false })}>
                Beheer
              </a>
            </>
          )}
        </nav>
      </header>

      <Routes>
        {/* Publiek */}
        <Route path="/formulier" element={<PublicInschrijven />} />
        <Route path="/contact" element={<Contact />} />

        {/* Beheer */}
        <Route path="/startlijst" element={<Startlijst />} />
        {/* Voeg later toe zodra de bestanden bestaan:
            <Route path="/protocollen" element={<ProtocolGenerator />} />
            <Route path="/uitslagen" element={<Einduitslag />} />
        */}

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/formulier" replace />} />
      </Routes>
    </Router>
  );
}
