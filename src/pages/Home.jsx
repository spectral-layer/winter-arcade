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

      <div className="homeCoverPanel">
        <h1 className="heroTitle">WINTER OLYMPIC GAMES</h1>
        <p className="heroSubtitle">Skill-based winter mini-games for holders.</p>

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
