// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";  // ✅ import the real App

const root = createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <div
      style={{
        background: "hotpink",
        color: "black",
        padding: "12px 16px",
        fontWeight: "bold",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      MOUNT-OK: React is running and rendering this banner.
    </div>
    <App />   {/* ✅ render your app below the banner */}
  </React.StrictMode>
);
