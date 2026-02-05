import { Link } from "react-router-dom";
import heroImg from "../assets/bg-milano-cortina.jpg";

export default function Home() {
  return (
    <div className="homeCover">
      {/* background blur */}
      <img className="heroBg" src={heroImg} alt="" aria-hidden="true" />

      <div className="homeCoverOverlay" />

      {/* foreground NO-CROP */}
      <img className="heroImg" src={heroImg} alt="Winter Olympic Games hero" />

      {/* PANEL TOP-LEFT */}
      <div className="homeCoverPanel topLeft">
        <h1 className="heroTitle">WINTER OLYMPIC GAMES</h1>

        <p className="heroSubtitle">
          Skill-based winter mini-game for holders.
        </p>

        <p className="heroSubtitle">
          Challenge live! Climb the leaderboard! 🏆
        </p>
        <p className="heroSubtitle">
          The winner gets a 500,000 token prize 💰
        </p>

        <div className="heroCtaRow">
          <Link className="btn ctaStrong" to="/arcade">
            Enter Arcade →
          </Link>
          <div className="heroHintStrong">Connect wallet to check access</div>
        </div>
      </div>
    </div>
  );
}
