import React from "react";

export default function Contact() {
  return (
    <div style={{ maxWidth: 720, margin: "24px auto", lineHeight: 1.5 }}>
      <h2>Contact</h2>
      <p>
        Heb je interesse in de Working Point wedstrijd-app, of wil je een demo of prijsinformatie?
        Neem gerust contact op; we reageren zo snel mogelijk.
      </p>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600 }}>E-mail</div>
        <div>
          <a href="mailto:organisator@workingpoint.nl">organisator@workingpoint.nl</a>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600 }}>Inschrijven voor een wedstrijd</div>
        <div>Gebruik het <b>Inschrijven</b>-menu bovenaan.</div>
      </div>
    </div>
  );
}
