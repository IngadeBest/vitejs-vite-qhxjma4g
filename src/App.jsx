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
      <header
        style={{
          background: "#fff",
          borderBottom: `3px solid ${kleuren.accent}`,
          textAlign: "center",
          padding: "24px 0 10px 0",
          marginBottom: 0,
          boxShadow: "0 1px 6px #20457412",
        }}
      >
        <span
          style={{
            fontSize: 42,
            verticalAlign: "middle",
            color: kleuren.accent,
            marginRight: 12,
            display: "inline-block",
          }}
        >
          🐴
        </span>
        <span
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: kleuren.hoofd,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            verticalAlign: "middle",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          WorkingPoint
        </span>
      </header>
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
        <Link to="/score-invoer" style={{ marginLeft: 22, color: kleuren.accent, fontWeight: 700 }}>
          Score-invoer
        </Link>
        <Link to="/einduitslag" style={{ marginLeft: 22, color: kleuren.accent, fontWeight: 700 }}>
          Einduitslag
        </Link>
      </nav>
      <Routes>
        <Route path="/" element={<RuiterInvoer />} />
        <Route path="/proeven" element={<ProefInstellingen />} />
        <Route path="/score-invoer" element={<ScoreInvoer />} />
        <Route path="/einduitslag" element={<Einduitslag />} />
      </Routes>
    </Router>
  );
}
