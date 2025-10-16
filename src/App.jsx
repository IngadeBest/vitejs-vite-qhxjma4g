import React from "react";
import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import DomainRedirect from "@/components/DomainRedirect";
import { isAppHost } from "@/lib/isAppHost";

// Pagina's
import Startlijst from "@/pages/Startlijst";
import Formulier from "@/pages/Formulier";
import Dashboard from "@/pages/Dashboard";
// ... importeer overige app-pagina's hier

export default function App() {
  return (
    <Router>
      <DomainRedirect />
      <Routes>
        {/* Publieke formulierroute – mag op beide hosts bereikbaar zijn */}
        <Route path="/formulier" element={<Formulier />} />

        {/* App-routes – bedoeld voor app.workingpoint.nl */}
        <Route path="/startlijst" element={<Startlijst />} />
        <Route path="/dashboard" element={<Dashboard />} />
        {/* ... jouw overige routes */}

        {/* Fallback hangt nu af van het domein */}
        <Route
          path="*"
          element={<Navigate to={isAppHost() ? "/startlijst" : "/formulier"} replace />}
        />
      </Routes>
    </Router>
  );
}
