import React from "react";
import { HashRouter as Router, Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import DomainRedirect from "@/DomainRedirect";
import "./App.css";
import { WedstrijdProvider, useWedstrijdContext } from "@/features/wedstrijden/context/WedstrijdContext";

// Pagina's
import PublicInschrijven from "@/features/inschrijven/pages/PublicInschrijven";
import InschrijfFormulier from "@/features/inschrijven/pages/InschrijfFormulier";
import WedstrijdStart from "@/features/wedstrijden/pages/WedstrijdStart";
import Startlijst from "@/features/startlijst/pages/Startlijst";
import Deelnemers from "@/features/deelnemers/pages/Deelnemers";
import ProtocolGenerator from "@/features/protocollen/pages/ProtocolGenerator";
import Einduitslag from "@/features/einduitslag/pages/Einduitslag";
import Contact from "@/features/public/pages/Contact";
import WedstrijdenBeheer from "@/features/wedstrijden/pages/WedstrijdenBeheer";
import WachtlijstBeheer from "@/features/wachtlijst/pages/WachtlijstBeheer";
import ProefInstellingen from "@/features/proeven/pages/ProefInstellingen";
import ScoreInvoer from "@/features/scoring/pages/ScoreInvoer";
import TrailGenerator from "@/features/trailgenerator/pages/TrailGenerator";
import { isAppHost } from "@/lib/isAppHost";

const navStyle = ({ isActive }) => ({
  padding: "8px 11px",
  borderRadius: 999,
  textDecoration: "none",
  color: isActive ? "#fff" : "#6b4827",
  background: isActive ? "#8b5a2b" : "#fff7ed",
  border: "1px solid " + (isActive ? "#7a4b20" : "#ecd9c2"),
  fontWeight: 700,
  whiteSpace: "nowrap",
});

const navGroups = [
  {
    title: "Wedstrijdpoint",
    to: "/wedstrijden",
    links: [
      ["/wedstrijden", "Wedstrijdbeheer"],
      ["/proeven", "Proeven"],
      ["/protocollen", "Protocollen"],
      ["/trailgenerator", "Trailgenerator"],
    ],
  },
  {
    title: "Deelnemers",
    to: "/deelnemers",
    links: [
      ["/deelnemers", "Deelnemers"],
      ["/startlijst", "Startlijst"],
      ["/wachtlijst", "Wachtlijst"],
    ],
  },
  {
    title: "Wedstrijddag",
    to: "/scores",
    links: [
      ["/scores", "Score invoer"],
      ["/uitslagen", "Uitslagen"],
    ],
  },
];

function AppHeader({ onApp, hasSelection }) {
  const { selectedWedstrijd } = useWedstrijdContext();
  const subtitle = onApp
    ? (hasSelection ? `Geselecteerd: ${selectedWedstrijd?.naam || "wedstrijd"}` : "Kies eerst een wedstrijd")
    : "Beheer van inschrijving tot uitslag";

  return (
    <header className="wp-app-header">
      <div className="wp-app-brand">
        <div className="wp-app-brand-title">Working Point</div>
        <div className="wp-app-brand-subtitle">{subtitle}</div>
      </div>

      <nav className="wp-app-nav">
        {onApp ? (
          navGroups.map((group) => (
            <div
              key={group.title}
              className={`wp-nav-group wp-nav-dropdown${group.title === "Wedstrijddag" ? " wp-nav-dropdown-right" : ""}`}
            >
              <NavLink to={group.to} style={navStyle} className="wp-nav-top-link">
                {group.title}
              </NavLink>
              <div className="wp-nav-group-title">{group.title}</div>
              <div className="wp-nav-group-links">
                {group.links.map(([to, label]) => (
                  <NavLink key={to} to={to} style={navStyle}>
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="wp-nav-group">
            <div className="wp-nav-group-title">Publiek</div>
            <div className="wp-nav-group-links">
              <NavLink to="/formulier" style={navStyle}>Inschrijven</NavLink>
              <NavLink to="/contact" style={navStyle}>Contact</NavLink>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}

function InnerApp() {
  const defaultOnApp = isAppHost();

  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const menuOverride = params.get("menu"); // allow ?menu=public or ?menu=beheer

  let onApp = defaultOnApp;
  if (menuOverride === "public") onApp = false;
  if (menuOverride === "beheer" || menuOverride === "admin") onApp = true;

  const { selectedWedstrijdId, selectedWedstrijd } = useWedstrijdContext();
  const hasSelection = !!selectedWedstrijdId;
  const appRootElement = onApp
    ? (hasSelection ? <Navigate to="/wedstrijden" replace /> : <WedstrijdStart />)
    : <Navigate to="/formulier" replace />;

  return (
    <>
      <DomainRedirect />

      <AppHeader onApp={onApp} hasSelection={hasSelection} />

      <Routes>
  {/* Publiek */}
  <Route path="/formulier" element={onApp ? <InschrijfFormulier /> : <PublicInschrijven />} />
        <Route path="/contact" element={<Contact />} />

  {/* Beheer */}
  <Route path="/" element={onApp ? appRootElement : <Navigate to="/formulier" replace />} />
  <Route path="/startlijst" element={<Startlijst />} />
  <Route path="/deelnemers" element={<Deelnemers />} />
  <Route path="/protocollen" element={<ProtocolGenerator />} />
  <Route path="/trailgenerator" element={<TrailGenerator />} />
  <Route path="/proeven" element={<ProefInstellingen />} />
  <Route path="/scores" element={<ScoreInvoer />} />
  <Route path="/uitslagen" element={<Einduitslag />} />
  <Route path="/wedstrijden" element={<WedstrijdenBeheer />} />
  <Route path="/wachtlijst" element={<WachtlijstBeheer />} />

        {/* Fallback: on app.* default to wedstrijden, else formulier */}
        <Route path="*" element={<Navigate to={onApp ? "/wedstrijden" : "/formulier"} replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <WedstrijdProvider>
      <Router>
        <InnerApp />
      </Router>
    </WedstrijdProvider>
  );
}
