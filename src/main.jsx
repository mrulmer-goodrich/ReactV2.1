// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";          // 👈 add this line
import App from "./App.jsx";

const root = createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    {/* (You can remove the pink banner now if you want) */}
    <App />
  </React.StrictMode>
);
