"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          backgroundColor: "#f7fafd",
          color: "#181c1e",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: "480px",
            width: "100%",
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            padding: "32px",
            boxShadow: "0 8px 24px rgba(0, 22, 46, 0.08)",
            textAlign: "center",
          }}
        >
          <div style={{ fontWeight: 800, color: "#00162e", fontSize: "20px", marginBottom: "12px" }}>
            Top Joint
          </div>
          <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#00162e", margin: "0 0 8px" }}>
            Une erreur inattendue est survenue
          </h1>
          <p dir="rtl" style={{ fontSize: "16px", color: "#43474d", margin: "0 0 20px" }}>
            حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى.
          </p>
          {digest && (
            <p style={{ fontSize: "12px", color: "#74777e", margin: "0 0 16px" }}>Ref: {digest}</p>
          )}
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => retry()}
              style={{
                height: "42px",
                padding: "0 20px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#fc9430",
                color: "#00162e",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Réessayer / إعادة المحاولة
            </button>
            <a
              href="/fr"
              style={{
                height: "42px",
                padding: "0 20px",
                borderRadius: "8px",
                backgroundColor: "#00162e",
                color: "#ffffff",
                fontWeight: 700,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Accueil
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
