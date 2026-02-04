import { Outlet, useLocation, useNavigate } from "react-router-dom";
import WalletToggleButton from "./WalletToggleButton";

export default function WalletShellLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const isArcade = loc.pathname.startsWith("/arcade");

  const TOPBAR_H = 56;

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0b0f16",
        color: "rgba(255,255,255,0.92)",
        overflowX: "hidden",
      }}
    >
      {/* TOP BAR */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: TOPBAR_H,
          zIndex: 50,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <div
          style={{
            height: "100%",
            maxWidth: 1100,
            margin: "0 auto",
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            onClick={() => nav("/")}
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 0.2,
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            Winter Arcade
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isArcade && (
              <button className="btn" onClick={() => nav("/")}>
                Back to Home
              </button>
            )}
            <WalletToggleButton />
          </div>
        </div>
      </div>

      {/* PAGE */}
      <div
        style={{
          paddingTop: TOPBAR_H,
          minHeight: `calc(100dvh - ${TOPBAR_H}px)`,
          // per /arcade vogliamo FULL-BLEED: niente maxWidth, niente padding extra
          // per il resto mantieni un layout più "sito"
          width: "100%",
        }}
      >
        {isArcade ? (
          // FULLSCREEN ARCADE CANVAS
          <div
            style={{
              width: "100%",
              minHeight: `calc(100dvh - ${TOPBAR_H}px)`,
            }}
          >
            <Outlet />
          </div>
        ) : (
          // NORMAL PAGES (centrare e contenere)
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px" }}>
            <Outlet />
          </div>
        )}
      </div>
    </div>
  );
}
