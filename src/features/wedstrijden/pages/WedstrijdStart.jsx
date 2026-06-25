import React from "react";
import { useNavigate } from "react-router-dom";
import Container from "@/ui/Container";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Alert } from "@/ui/alert";
import { useWedstrijdContext } from "@/features/wedstrijden/context/WedstrijdContext";
import "./WedstrijdStart.css";

export default function WedstrijdStart() {
  const navigate = useNavigate();
  const {
    wedstrijden,
    loadingWedstrijden,
    wedstrijdenError,
    selectedWedstrijdId,
    setSelectedWedstrijdId,
    clearSelectedWedstrijd,
  } = useWedstrijdContext();

  const openExisting = () => {
    if (!selectedWedstrijdId) return;
    navigate("/wedstrijden");
  };

  const openNew = () => {
    clearSelectedWedstrijd();
    navigate("/wedstrijden?nieuw=1");
  };

  return (
    <div className="ws-shell">
      <Container maxWidth={1180} className="ws-container">
        <section className="ws-hero">
          <div>
            <div className="ws-kicker">Working Point</div>
            <h1>Kies een wedstrijd of maak een nieuwe aan</h1>
            <p>Start hier. Na selectie spring je door naar beheer, deelnemers, startlijst en wedstrijddag.</p>
          </div>
        </section>

        {(wedstrijdenError) && <Alert type="error">{wedstrijdenError.message || String(wedstrijdenError)}</Alert>}

        <section className="ws-grid">
          <article className="ws-card ws-card-feature">
            <h2>Nieuwe wedstrijd</h2>
            <p>Begin met een lege wedstrijd en vul daarna naam, datum en instellingen in.</p>
            <Button type="button" onClick={openNew} disabled={loadingWedstrijden}>
              Nieuwe wedstrijd aanmaken
            </Button>
          </article>

          <article className="ws-card">
            <h2>Bestaande wedstrijd</h2>
            <p>Selecteer een bestaande wedstrijd om verder te gaan met beheer of wedstrijddag.</p>
            <label>
              Wedstrijd
              <select
                value={selectedWedstrijdId}
                onChange={(e) => setSelectedWedstrijdId(e.target.value)}
                disabled={loadingWedstrijden}
              >
                <option value="">— kies wedstrijd —</option>
                {wedstrijden.map((wedstrijd) => (
                  <option key={wedstrijd.id} value={wedstrijd.id}>
                    {wedstrijd.naam} {wedstrijd.datum ? `(${wedstrijd.datum})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="ws-actions">
              <Button type="button" onClick={openExisting} disabled={!selectedWedstrijdId}>
                Open geselecteerde wedstrijd
              </Button>
            </div>
          </article>
        </section>
      </Container>
    </div>
  );
}
