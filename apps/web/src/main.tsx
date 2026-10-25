import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import BlueGreenDemo from "./BlueGreenDemo.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {window.location.pathname === "/demo/blue-green" ? <BlueGreenDemo /> : <App />}
  </StrictMode>
);
