import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { ensureSeedData } from "@/db/seed";

// Run seed before rendering. Awaiting here means the first paint
// already has data ready — no flicker of an empty app.
ensureSeedData()
  .catch((err) => console.error("Seed failed:", err))
  .finally(() => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StrictMode>
    );
  });