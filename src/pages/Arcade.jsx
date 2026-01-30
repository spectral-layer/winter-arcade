import { Link, Outlet } from "react-router-dom";
import BackButton from "../components/BackButton.jsx";
import heroImg from "../assets/bg-milano-cortina.jpg";

export default function Arcade() {
  return (
    <div className="homeCover">
      {/* background blur */}
      <img className="heroBg" src={heroImg} alt="" aria-hidden="true" />

      <div className="homeCoverOverlay" />

      {/* foreground NO-CROP */}
      <img className="heroImg" src={heroImg} alt="Winter Arcade hero" />

      <div className="homeCoverPanel">
        <BackButton to="/" label="← Back to Home" />

        <h2 className="heroTitle">🎮 Arcade</h2>
        <p className="heroSubtitle">Choose a game:</p>

        <div className="list">
          {/* Ice Slalom */}
          <Link className="gameRow" to="/arcade/ice-slalom">
            <span className="gameEmoji">🎿</span>
            <span>
              <div className="gameRowTitle">Ice Slalom</div>
              <div className="gameRowDesc">Reflexes, speed, obstacles.</div>
            </span>
          </Link>

          {/* Snowball Frenzy (ora sotto /arcade) */}
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

        {/* ✅ Qui verranno renderizzati i giochi nested: /arcade/ice-slalom e /arcade/snowball */}
        <Outlet />
      </div>
    </div>
  );
}
