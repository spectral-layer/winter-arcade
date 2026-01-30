import { Outlet, useLocation, useNavigate } from "react-router-dom";
import WalletToggleButton from "./WalletToggleButton";

export default function WalletShellLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const isArcade = loc.pathname.startsWith("/arcade");

  return (
    <div style={{ minHeight: "100vh", background: "#0b0f16", color: "rgba(255,255,255,0.92)" }}>
      {/* TOP BAR */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 56,
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
      <div style={{ paddingTop: 56 }}>
        <Outlet />
      </div>
    </div>
  );
}
