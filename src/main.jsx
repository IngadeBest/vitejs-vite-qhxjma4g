import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary";
import "./ui/tokens.css";
import "./index.css"; 

// tijdelijk: force-unregister any existing service workers so clients fetch fresh assets
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
	try {
		navigator.serviceWorker.getRegistrations().then(regs => {
			regs.forEach(reg => {
				reg.unregister().catch(() => { /* ignore */ });
			});
		});
	} catch (e) {
		// best-effort cleanup; ignore errors
		// eslint-disable-next-line no-console
		console.warn('SW unregister failed', e);
	}
}

const rootEl = document.getElementById("root");
createRoot(rootEl).render(
	<ErrorBoundary>
		<App />
	</ErrorBoundary>
);
