import React from "react";
import { HashRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import InschrijfFormulier from "@/features/inschrijven/pages/InschrijfFormulier";
import Startlijst from "@/features/startlijst/pages/Startlijst";
import ProtocolGenerator from "@/features/protocollen/pages/ProtocolGenerator";

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
        <nav style={{display:"flex",gap:10,marginLeft:"auto"}}>
          <NavLink to="/" style={navStyle} end>Inschrijven</NavLink>
          <NavLink to="/startlijst" style={navStyle}>Startlijst</NavLink>
          <NavLink to="/protocollen" style={navStyle}>Protocollen</NavLink>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<InschrijfFormulier />} />
        <Route path="/startlijst" element={<Startlijst />} />
        <Route path="/protocollen" element={<ProtocolGenerator />} />
      </Routes>
    </Router>
  );
}
