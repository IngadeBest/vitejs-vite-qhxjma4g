import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import PublicResults from './features/publicResults/PublicResults';
import { isRecoveryLocation } from './features/auth/recoveryLocation';
const ResetPassword = lazy(() => import('./features/auth/pages/ResetPassword'));
const App = lazy(() => import('./App.jsx'));
import ErrorBoundary from "./components/ErrorBoundary";
import "./ui/tokens.css";
import "./index.css"; 
const rootEl = document.getElementById("root");
const isPublicResults = window.location.pathname.startsWith('/results/') || window.location.hash.startsWith('#/results/');
const PublicRouter = window.location.pathname.startsWith('/results/') ? BrowserRouter : HashRouter;
createRoot(rootEl).render(
	<ErrorBoundary>
    {isRecoveryLocation(window.location) ? <Suspense fallback={<p role="status">Wachtwoordherstel laden…</p>}><ResetPassword /></Suspense> : isPublicResults ? <PublicRouter><Routes><Route path="/results/:eventId" element={<PublicResults />} /></Routes></PublicRouter> :
      <Suspense fallback={<p role="status">WorkingPoint laden…</p>}><App /></Suspense>}
	</ErrorBoundary>
);
