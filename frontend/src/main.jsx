import React from "react";
import ReactDOM from "react-dom/client";
import { ActivationGate } from "@chamber-19/desktop-toolkit/activation";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ActivationGate>
      <App />
    </ActivationGate>
  </React.StrictMode>
);