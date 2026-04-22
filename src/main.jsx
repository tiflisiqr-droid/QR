import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ErrorBoundary } from "./ErrorBoundary.jsx";
import App from "../tiflisi-menu.jsx";

const rawBase = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const routerBasename = rawBase === "" ? undefined : rawBase;

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <BrowserRouter basename={routerBasename}>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>
  );
} else {
  console.error("Tiflisi menu: #root element not found.");
}
