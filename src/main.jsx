import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css"; 

const rootEl = document.getElementById("root");
createRoot(rootEl).render(
	<ErrorBoundary>
		<App />
	</ErrorBoundary>
);
