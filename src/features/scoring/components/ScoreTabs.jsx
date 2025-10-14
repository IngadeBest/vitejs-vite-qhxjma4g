// src/ScoreTabs.jsx
import { Routes, Route, Link, useLocation } from "react-router-dom";
import ScoreInvoer from "./ScoreInvoer";
import Einduitslag from "./Einduitslag";
import { supabase } from "@/lib/supabaseClient";

const kleuren = {
  hoofd: "#204574",
  accent: "#3a8bfd",
};

export default function ScoreTabs() {
  const location = useLocation();
  const isEinduitslag = location.pathname.includes("/score/einduitslag");

  return (

    <div>
      <div style={{
        display: "flex",
        gap: 0,
        margin: "0 auto",
        maxWidth: 900,
        paddingTop: 18,
      }}>
        <Link
          to="/score"
          style={{
            flex: 1,
            padding: "16px 0",
            textAlign: "center",
            background: !isEinduitslag ? kleuren.accent : "#e6eefb",
            color: !isEinduitslag ? "#fff" : kleuren.hoofd,
            fontWeight: 800,
            borderRadius: "16px 0 0 0",
            letterSpacing: 1,
            textDecoration: "none",
            fontSize: 17,
            borderRight: "1px solid #ccc",
            transition: "background 0.2s",
          }}
        >
          Score-invoer
        </Link>
        <Link
          to="/score/einduitslag"
          style={{
            flex: 1,
            padding: "16px 0",
            textAlign: "center",
            background: isEinduitslag ? kleuren.accent : "#e6eefb",
            color: isEinduitslag ? "#fff" : kleuren.hoofd,
            fontWeight: 800,
            borderRadius: "0 16px 0 0",
            letterSpacing: 1,
            textDecoration: "none",
            fontSize: 17,
            borderLeft: "1px solid #ccc",
            transition: "background 0.2s",
          }}
        >
          Einduitslag
        </Link>
      </div>
      <div>
        <Routes>
          <Route index element={<ScoreInvoer />} />
          <Route path="einduitslag" element={<Einduitslag />} />
        </Routes>
      </div>
    </div>
  );
}
