import React from "react";
import { HashRouter as Router, Routes, Route, NavLink, Navigate } from "react-router-dom";
import DomainRedirect from "@/DomainRedirect";

import PublicInschrijven from "@/features/inschrijven/pages/PublicInschrijven";
import Startlijst from "@/features/startlijst/pages/Startlijst";

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
          <NavLink to="/formulier" style={navStyle}>
            Inschrijven
          </NavLink>
          <NavLink to="/startlijst" style={navStyle}>Startlijst</NavLink>
        </nav>
      </header>

      <Routes>
        <Route path="/formulier" element={<PublicInschrijven />} />
        <Route path="/startlijst" element={<Startlijst />} />
        <Route path="*" element={<Navigate to="/formulier" replace />} />
      </Routes>
    </Router>
  );
}
