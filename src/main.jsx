import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "../tiflisi-menu.jsx";

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} else {
  console.error("Tiflisi menu: #root element not found.");
}
