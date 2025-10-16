import React from "react";
import { HashRouter as Router, Routes, Route, NavLink, Navigate } from "react-router-dom";
import DomainRedirect from "@/DomainRedirect";

// Jouw pagina’s
import PublicInschrijven from "@/features/inschrijven/pages/PublicInschrijven";
import Startlijst from "@/features/startlijst/pages/Startlijst";
import ProtocolGenerator from "@/features/protocollen/pages/ProtocolGenerator";
import Tussenstand from "@/features/uitslag/pages/Tussenstand";
import Einduitslag from "@/features/uitslag/pages/Einduitslag";
import WedstrijdenBeheer from "@/features/wedstrijden/pages/WedstrijdenBeheer";

const navStyle = ({ isActive }) => ({
  padding: "8px 10px",
  borderRadius: 8,
  textDecoration: "none",
  color: isActive ? "#fff" : "#2b6cb0",
  background: isActive ? "#2b6cb0" : "transparent",
  fontWeight: 700,
});

export default function App() {
  return (
    <Router>
      {/* Domein-afhankelijke routering */}
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
          {/* LET OP: inschrijven linkt naar /formulier (niet naar /) */}
          <NavLink to="/formulier" style={navStyle}>Inschrijven</NavLink>
          <NavLink to="/startlijst" style={navStyle}>Startlijst</NavLink>
          <NavLink to="/protocollen" style={navStyle}>Protocollen</NavLink>
          <NavLink to="/tussenstand" style={navStyle}>Tussenstand</NavLink>
          <NavLink to="/einduitslag" style={navStyle}>Einduitslag</NavLink>
          <NavLink to="/wedstrijden" style={navStyle}>Wedstrijden</NavLink>
        </nav>
      </header>

      <Routes>
        {/* MAIN-domein */}
        <Route path="/formulier" element={<PublicInschrijven />} />

        {/* APP-domein */}
        <Route path="/startlijst" element={<Startlijst />} />
        <Route path="/protocollen" element={<ProtocolGenerator />} />
        <Route path="/tussenstand" element={<Tussenstand />} />
        <Route path="/einduitslag" element={<Einduitslag />} />
        <Route path="/wedstrijden" element={<WedstrijdenBeheer />} />

        {/* Fallback: neutraal naar /formulier; DomainRedirect stuurt op app.* direct door naar /startlijst */}
        <Route path="*" element={<Navigate to="/formulier" replace />} />
      </Routes>
    </Router>
  );
}
