import { HashRouter as Router, Routes, Route, Link } from "react-router-dom";
import RuiterInvoer from "./RuiterInvoer";
import ProefInstellingen from "./ProefInstellingen";
import ScoreInvoer from "./ScoreInvoer";
import Einduitslag from "./Einduitslag";

const kleuren = {
  hoofd: "#204574",
  accent: "#3a8bfd",
  achtergrond: "#f5f7fb",
  wit: "#fff",
};

export default function App() {
  return (
    <Router>
      <nav
        style={{
          padding: "1rem",
          borderBottom: "1px solid #ccc",
          textAlign: "center",
          marginBottom: 18,
          background: "#fff",
        }}
      >
        <Link to="/" style={{ color: kleuren.accent, fontWeight: 700 }}>
          Ruiters
        </Link>
        <Link to="/proeven" style={{ marginLeft: 22, color: kleuren.accent, fontWeight: 700 }}>
          Proeven
        </Link>
        <Link to="/score" style={{ marginLeft: 22, color: kleuren.accent, fontWeight: 700 }}>
          Score-invoer
        </Link>
        <Link to="/einduitslag" style={{ marginLeft: 22, color: kleuren.accent, fontWeight: 700 }}>
          Einduitslag
        </Link>
      </nav>
      <Routes>
        <Route path="/" element={<RuiterInvoer />} />
        <Route path="/proeven" element={<ProefInstellingen />} />
        <Route path="/score" element={<ScoreInvoer />} />
        <Route path="/einduitslag" element={<Einduitslag />} />
      </Routes>
    </Router>
  );
}
