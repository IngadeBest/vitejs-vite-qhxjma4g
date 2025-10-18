import React from "react";

export default function Contact() {
  return (
    <div style={{ maxWidth: 800, margin: "24px auto", lineHeight: 1.5 }}>
      <h2>Contact</h2>
      <p>
        Heb je interesse in de Working Point wedstrijd-app of wil je een demo?
        Neem gerust contact op.
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "200px 1fr",
        gap: "10px 12px",
        alignItems: "center",
        marginTop: 12
      }}>
        <div>Algemeen</div>
        <div><a href="mailto:info@workingpoint.nl">info@workingpoint.nl</a></div>

        <div>Inschrijvingen</div>
        <div>Gebruik het <b>inschrijfformulier</b> via de navigatie.</div>
      </div>

      <div style={{
        marginTop: 24,
        padding: 12,
        background: "#f7f9fc",
        border: "1px solid #e6eefc",
        borderRadius: 8
      }}>

      </div>
    </div>
  );
}
