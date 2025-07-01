import { Link } from "react-router-dom";

export default function Einduitslag() {
  return (
    <div style={{ background: "#f5f7fb", minHeight: "100vh", padding: "24px 0" }}>
      <div style={{
        maxWidth: 750,
        background: "#fff",
        borderRadius: 16,
        boxShadow: "0 6px 24px #20457422",
        margin: "0 auto",
        padding: "40px 32px 28px 32px",
        fontFamily: "system-ui, sans-serif"
      }}>
        <div style={{ marginBottom: 12, textAlign: "right" }}>
          <Link
            to="/score-invoer"
            style={{
              color: "#3a8bfd",
              fontWeight: 700,
              textDecoration: "none",
              fontSize: 18,
              border: "1px solid #3a8bfd",
              borderRadius: 8,
              padding: "5px 18px",
              background: "#f5f7fb",
              transition: "background 0.2s, color 0.2s",
            }}
            onMouseOver={e => e.currentTarget.style.background = "#e7f0fa"}
            onMouseOut={e => e.currentTarget.style.background = "#f5f7fb"}
          >
            ← Terug naar score-invoer
          </Link>
        </div>
        <h2 style={{ fontSize: 33, fontWeight: 900, color: "#204574", letterSpacing: 1.2, marginBottom: 22 }}>
          Einduitslag
        </h2>
        <div style={{ color: "#888", fontSize: 18, textAlign: "center" }}>
          Hier komt de einduitslag-weergave.
        </div>
      </div>
    </div>
  );
}
