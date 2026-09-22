"use client";


import { useEffect, useState } from "react";

export default function HydrationWrapper({ children }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    document.body.classList.add("loading");

    const timer = setTimeout(() => {
      setHydrated(true);
      document.body.classList.remove("loading");
    }, 0);

    return () => {
      clearTimeout(timer);
      document.body.classList.remove("loading");
    };
  }, []);

  if (!hydrated) {
    return (
      <div className="loading-page">
        <div className="loading-glow" />

        <p
          className="font-display loading-logo gitroast-loader-text-fire"
          style={{
            background: "linear-gradient(135deg, #FF4500, #FF6B00, #FFB700)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            fontSize: "28px",
          }}
        >
          GITROAST 🔥
        </p>

        <div className="loading-card">
          <p
            className="font-mono loading-text"
            style={{ color: "var(--text-secondary)", fontSize: "13px" }}
          >
            Loading
            <span className="loading-dot">.</span>
            <span className="loading-dot">.</span>
            <span className="loading-dot">.</span>
          </p>

          <div className="loading-track">
            <div className="loading-fill" />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
