// src/pages/Arcade.jsx
import { Link, Outlet, useLocation } from "react-router-dom";
import BackButton from "../components/BackButton.jsx";
import heroImg from "../assets/bg-milano-cortina.jpg";

export default function Arcade() {
  const loc = useLocation();

  // ✅ quando siamo dentro un gioco nested, vogliamo fullscreen (niente pannello laterale)
  const isGameRoute =
    loc.pathname.startsWith("/arcade/ice-slalom") ||
    loc.pathname.startsWith("/arcade/snowball");

  if (isGameRoute) {
    return (
      <div
        style={{
          position: "relative",
          height: "calc(100dvh - 56px)", // topbar height in WalletShellLayout
          width: "100%",
          overflow: "hidden",
          background: "#0b0f16",
        }}
      >
        {/* background blur */}
        <img
          src={heroImg}
          alt=""
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "blur(18px)",
            transform: "scale(1.05)",
            opacity: 0.45,
          }}
        />

        {/* dark overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
          }}
        />

        {/* FULLSCREEN GAME AREA */}
        <div
          style={{
            position: "relative",
            height: "100%",
            width: "100%",
            overflow: "hidden",
          }}
        >
          <Outlet />
        </div>
      </div>
    );
  }

  // ✅ menu arcade
  return (
    <div className="homeCover">
      {/* background blur */}
      <img className="heroBg" src={heroImg} alt="" aria-hidden="true" />

      <div className="homeCoverOverlay" />

      {/* foreground NO-CROP */}
      <img className="heroImg" src={heroImg} alt="Winter Arcade hero" />

      {/* ✅ Arcade panel: separate class so it won’t affect Home */}
      <div className="homeCoverPanel topLeft arcadePanel">
        <BackButton to="/" label="← Back to Home" />

        <h2 className="heroTitle">🎮 Arcade</h2>
        <p className="heroSubtitle">Choose a game:</p>

        <div className="list">
          {/* Snowball Frenzy */}
          <Link className="gameRow" to="/arcade/snowball">
            <span className="gameEmoji">❄️</span>
            <span>
              <div className="gameRowTitle">Snowball Frenzy</div>
              <div className="gameRowDesc">Aim, timing, chaos.</div>
            </span>
          </Link>

          {/* Winner & Wall of Fame */}
          <Link className="btn" to="/winner" style={{ marginTop: 16 }}>
            🏅 Winner
          </Link>

          <Link className="btn" to="/wall-of-fame" style={{ marginTop: 8 }}>
            🏆 Wall of Fame
          </Link>
        </div>
      </div>
    </div>
  );
}
