import { Routes, Route, Navigate } from "react-router-dom";

import WalletShellLayout from "./components/WalletShellLayout";

import Home from "./pages/Home";
import Arcade from "./pages/Arcade";
import WallOfFame from "./pages/WallOfFame";
import Winner from "./pages/Winner";

// ✅ IMPORTA le pagine dei giochi (adatta i path se sono in /pages o /games)
import IceSlalom from "./pages/IceSlalom";
import Snowball from "./pages/Snowball";

export default function App() {
  return (
    <Routes>
      <Route element={<WalletShellLayout />}>
        <Route path="/" element={<Home />} />

        {/* ✅ Arcade come parent + nested routes */}
        <Route path="/arcade" element={<Arcade />}>
          <Route path="ice-slalom" element={<IceSlalom />} />
          <Route path="snowball" element={<Snowball />} />
        </Route>

        {/* ✅ (Opzionale) Alias: /snowball -> /arcade/snowball */}
        <Route path="/snowball" element={<Navigate to="/arcade/snowball" replace />} />

        <Route path="/wall-of-fame" element={<WallOfFame />} />
        <Route path="/winner" element={<Winner />} />
      </Route>
    </Routes>
  );
}
