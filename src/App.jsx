import React from "react";
import { HashRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import InschrijfFormulier from "@/features/inschrijven/pages/InschrijfFormulier";
import Startlijst from "@/features/startlijst/pages/Startlijst";
import ProtocolGenerator from "@/features/protocollen/pages/ProtocolGenerator";
import PublicInschrijven from "@/features/inschrijven/pages/PublicInschrijven";
import Tussenstand from "@/features/uitslag/pages/Tussenstand";
import Einduitslag from "@/features/uitslag/pages/Einduitslag";
import WedstrijdenBeheer from "@/features/wedstrijden/pages/WedstrijdenBeheer";

const navStyle = ({ isActive }) => ({
  padding: "8px 10px",
  borderRadius: 8,
  textDecoration: "none",
  color: isActive ? "#fff" : "#2b6cb0",
  background: isActive ? "#2b6cb0" : "transparent",
  fontWeight: 700
});

export default function App() {
  return (
    <Router>
      <header style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:"1px solid #eee",position:"sticky",top:0,background:"#fff",zIndex:10}}>
        <div style={{fontWeight:800,fontSize:18,color:"#102754"}}>Working Point</div>
        <nav style={{display:"flex",gap:10,marginLeft:"auto",flexWrap:"wrap"}}>
          <NavLink to="/" style={navStyle} end>Inschrijven</NavLink>
          <NavLink to="/startlijst" style={navStyle}>Startlijst</NavLink>
          <NavLink to="/protocollen" style={navStyle}>Protocollen</NavLink>
          <NavLink to="/tussenstand" style={navStyle}>Tussenstand</NavLink>
          <NavLink to="/einduitslag" style={navStyle}>Einduitslag</NavLink>
          <NavLink to="/wedstrijden" style={navStyle}>Wedstrijden</NavLink>
        </nav>
      </header>
      // src/App.jsx
import React from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";

import DomainRedirect from "@/DomainRedirect";

// PAS DEZE IMPORTS AAN naar jouw padnamen:
import Formulier from "@/features/inschrijven/pages/Formulier";
import Startlijst from "@/features/startlijst/pages/Startlijst";
// import ... eventuele andere beheerpagina’s

export default function App() {
  return (
    <HashRouter>
      {/* Domeinlogica: cross-domain routering */}
      <DomainRedirect />

      <Routes>
        {/* Formulier-route (alleen zichtbaar op MAIN domein; DomainRedirect bewaakt dit) */}
        <Route path="/formulier" element={<Formulier />} />

        {/* Beheer-routes (alleen zichtbaar op APP domein; DomainRedirect bewaakt dit) */}
        <Route path="/startlijst" element={<Startlijst />} />
        {/* <Route path="/einduitslag" element={<Einduitslag />} /> */}
        {/* <Route path="/protocollen" element={<ProtocolGenerator />} /> */}
        {/* ...meer beheer-routes... */}

        {/* Fallback: laat neutraal naar /formulier gaan (DomainRedirect stuurt op app.* door naar /startlijst) */}
        <Route path="*" element={<Navigate to="/formulier" replace />} />
      </Routes>
    </HashRouter>
  );
}

      <Routes>
        <Route path="/" element={<InschrijfFormulier />} />
        <Route path="/startlijst" element={<Startlijst />} />
        <Route path="/protocollen" element={<ProtocolGenerator />} />
        <Route path="/formulier" element={<PublicInschrijven />} />
        <Route path="/tussenstand" element={<Tussenstand />} />
        <Route path="/einduitslag" element={<Einduitslag />} />
        <Route path="/wedstrijden" element={<WedstrijdenBeheer />} />
      </Routes>
    </Router>
  );
}
