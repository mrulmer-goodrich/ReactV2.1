// MOUNT SANITY TEST main.jsx
import React from "react";
import { createRoot } from "react-dom/client";

⬇️ comment App out for now to avoid any App-level crashes masking the mount
import App from "./App.jsx";

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
    {/* <App /> */}
  </React.StrictMode>
);
