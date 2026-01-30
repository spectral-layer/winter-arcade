import { Link } from "react-router-dom";

export default function BackButton({ to = "/", label = "← Back" }) {
  return (
    <Link className="backBtn" to={to}>
      {label}
    </Link>
  );
}
