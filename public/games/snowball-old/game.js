(() => {
  // ==============================
  // SNOWBALL FRENZY — PS1/ARCADE STYLE
  // ==============================

  const GAME_KEY = "snowball";

  // --- DOM ---
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });

  const overlay = document.getElementById("overlay");
  const gameover = document.getElementById("gameover");

  const btnStart = document.getElementById("btnStart");
  const btnRestart = document.getElementById("btnRestart");
  const btnSound = document.getElementById("btnSound");
  const btnSend = document.getElementById("btnSend");
  const btnPlayAgain = document.getElementById("btnPlayAgain");

  const uiScore = document.getElementById("uiScore");
  const uiTime = document.getElementById("uiTime");
  const uiStreak = document.getElementById("uiStreak");
  const uiFinal = document.getElementById("uiFinal");

  // --- Render: internal low-res buffer, scaled up nearest-neighbor ---
  const RENDER_W = 320;
  const RENDER_H = 180;
  const rCanvas = document.createElement("canvas");
  rCanvas.width = RENDER_W;
  rCanvas.height = RENDER_H;
  const rctx = rCanvas.getContext("2d", { alpha: false });
  rctx.imageSmoothingEnabled = false;
  ctx.imageSmoothingEnabled = false;

  function fitCanvasToViewport() {
    const vw = Math.max(1, window.innerWidth);
    const vh = Math.max(1, window.innerHeight);

    const targetAR = 16 / 9;
    let w = vw;
    let h = Math.floor(vw / targetAR);
    if (h > vh) {
      h = vh;
      w = Math.floor(vh * targetAR);
    }

    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.style.display = "block";
    canvas.style.margin = "0 auto";
  }
  window.addEventListener("resize", fitCanvasToViewport);
  fitCanvasToViewport();

  async function requestFs() {
    const el = document.getElementById("app") || canvas;
    try {
      if (!document.fullscreenElement && el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: "hide" });
      }
    } catch (_) {}
  }
  function inFs() {
    return !!document.fullscreenElement;
  }

  // --- Input: drag to aim, hold to charge, release to throw ---
  const aim = { x: 0, y: 0 }; // [-1..1]
  let holding = false;
  let holdStart = 0;
  let pointerDown = false;

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function setAimFromClient(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((clientY - rect.top) / rect.height) * 2 - 1;

    // aim centered around middle, but mostly use upper area
    aim.x = clamp(nx, -1, 1);
    aim.y = clamp(ny, -1, 1);
  }

  function onDown(clientX, clientY) {
    pointerDown = true;
    holding = true;
    holdStart = performance.now();
    setAimFromClient(clientX, clientY);
  }

  function onMove(clientX, clientY) {
    if (!pointerDown) return;
    setAimFromClient(clientX, clientY);
  }

  function onUp() {
    pointerDown = false;
    if (state !== STATE.running) {
      holding = false;
      return;
    }
    if (holding) {
      throwSnowball();
    }
    holding = false;
  }

  canvas.addEventListener("mousedown", (e) => onDown(e.clientX, e.clientY));
  window.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
  window.addEventListener("mouseup", onUp);

  canvas.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      if (!t) return;
      onDown(t.clientX, t.clientY);
    },
    { passive: true }
  );
  canvas.addEventListener(
    "touchmove",
    (e) => {
      const t = e.touches[0];
      if (!t) return;
      onMove(t.clientX, t.clientY);
    },
    { passive: true }
  );
  canvas.addEventListener("touchend", onUp, { passive: true });
  canvas.addEventListener("touchcancel", onUp, { passive: true });

  // --- Audio toggle (placeholder) ---
  let soundOn = true;
  function setSoundUI() {
    btnSound.textContent = soundOn ? "🔊 Sound" : "🔇 Sound";
  }
  setSoundUI();
  btnSound.addEventListener("click", () => {
    soundOn = !soundOn;
    setSoundUI();
  });

  // --- Game state ---
  const STATE = { idle: "idle", running: "running", over: "over" };
  let state = STATE.idle;

  const RUN_SECONDS = 30;
  let tLeft = RUN_SECONDS;
  let score = 0;
  let streak = 0;

  // Targets & projectiles
  let targets = [];
  let balls = [];
  let particles = [];
  let seed = 12345;

  function rand01() {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return (seed & 0x7fffffff) / 0x80000000;
  }

  function resetRun() {
    tLeft = RUN_SECONDS;
    score = 0;
    streak = 0;

    seed = (Date.now() >>> 0) ^ 0xBADC0FFE;
    targets = [];
    balls = [];
    particles = [];

    // spawn initial targets
    for (let i = 0; i < 8; i++) spawnTarget(true);

    updateHud();
    setSendState(false);
  }

  function spawnTarget(initial = false) {
    // target position in pseudo 3D: y is depth
    const z = initial ? rand01() * 0.6 + 0.2 : 0.9;
    const x = (rand01() * 2 - 1) * 0.85;
    const y = (rand01() * 2 - 1) * 0.45 - 0.2;

    targets.push({
      x,
      y,
      z,
      r: 0.10 + rand01() * 0.06,
      vx: (rand01() * 2 - 1) * (0.12 + rand01() * 0.18),
      vy: (rand01() * 2 - 1) * (0.10 + rand01() * 0.18),
      alive: true,
      kind: rand01() < 0.25 ? "gold" : "blue",
    });
  }

  function throwSnowball() {
    const now = performance.now();
    const heldMs = clamp(now - holdStart, 0, 1400);
    const pwr = clamp(heldMs / 900, 0.18, 1.0);

    // convert aim to direction in screen space
    const dirX = aim.x * 0.95;
    const dirY = aim.y * 0.65;

    balls.push({
      x: 0,
      y: 0.55,     // from player at bottom
      z: 0.0,
      dx: dirX * (0.018 + 0.020 * pwr),
      dy: dirY * (0.014 + 0.020 * pwr),
      dz: 0.040 + 0.060 * pwr,
      life: 1.0,
      pwr,
    });
  }

  // --- Score posting ---
  let sent = false;
  function setSendState(isSent) {
    sent = isSent;
    btnSend.disabled = !!sent;
    btnSend.textContent = sent ? "Sent ✅" : "Send Score";
  }

  function postScore() {
    const payload = { type: "WINTER_ARCADE_SCORE", game: GAME_KEY, score: Math.max(0, Math.floor(score)) };
    try {
      window.parent.postMessage(payload, window.location.origin);
      setSendState(true);
    } catch (e) {
      try {
        window.parent.postMessage(payload, "*");
        setSendState(true);
      } catch (_) {}
    }
  }

  btnSend.addEventListener("click", () => {
    if (state !== STATE.over) return;
    if (sent) return;
    postScore();
  });

  btnRestart.addEventListener("click", async () => {
    if (inFs()) {
      // keep fullscreen stable
    }
    hideGameOver();
    overlay.classList.add("hidden");
    state = STATE.running;
    resetRun();
  });

  btnPlayAgain.addEventListener("click", async () => {
    hideGameOver();
    state = STATE.running;
    resetRun();
  });

  btnStart.addEventListener("click", async () => {
    await requestFs();
    overlay.classList.add("hidden");
    state = STATE.running;
    resetRun();
  });

  function showGameOver() {
    state = STATE.over;
    uiFinal.textContent = String(Math.max(0, Math.floor(score)));
    gameover.classList.remove("hidden");
  }

  function hideGameOver() {
    gameover.classList.add("hidden");
    setSendState(false);
  }

  function updateHud() {
    uiScore.textContent = String(Math.max(0, Math.floor(score)));
    uiTime.textContent = String(Math.max(0, Math.ceil(tLeft)));
    uiStreak.textContent = String(streak);
  }

  // --- Retro effects ---
  function drawScanlines() {
    rctx.save();
    rctx.globalAlpha = 0.12;
    rctx.fillStyle = "#000";
    for (let y = 0; y < RENDER_H; y += 2) rctx.fillRect(0, y, RENDER_W, 1);
    rctx.restore();
  }
  function drawNoise() {
    rctx.save();
    rctx.globalAlpha = 0.06;
    rctx.fillStyle = "#000";
    for (let i = 0; i < 160; i++) {
      const x = (Math.random() * RENDER_W) | 0;
      const y = (Math.random() * RENDER_H) | 0;
      rctx.fillRect(x, y, 1, 1);
    }
    rctx.restore();
  }

  // --- Drawing helpers (pseudo 3D in 2D) ---
  function toScreen(p) {
    // p.x, p.y in [-1..1], p.z in [0..1]
    const z = clamp(p.z, 0.02, 1.0);
    const inv = 1 / (0.55 + z * 1.45);

    const cx = RENDER_W * 0.5;
    const cy = RENDER_H * 0.45;

    return {
      x: cx + p.x * 180 * inv,
      y: cy + p.y * 120 * inv + z * 36,
      s: inv,
    };
  }

  function drawBackground() {
    // sky
    rctx.fillStyle = "#081220";
    rctx.fillRect(0, 0, RENDER_W, RENDER_H);

    // aurora-ish bands (arcade vibe)
    for (let i = 0; i < 6; i++) {
      const y = 18 + i * 10;
      rctx.fillStyle = `rgba(80, 220, 255, ${0.04 + i * 0.01})`;
      rctx.fillRect(0, y, RENDER_W, 2);
    }

    // ground snow gradient
    const g = rctx.createLinearGradient(0, 70, 0, RENDER_H);
    g.addColorStop(0, "rgb(200,230,255)");
    g.addColorStop(1, "rgb(160,210,255)");
    rctx.fillStyle = g;
    rctx.fillRect(0, 70, RENDER_W, RENDER_H - 70);

    // vignette
    rctx.save();
    rctx.globalAlpha = 0.22;
    rctx.fillStyle = "#000";
    rctx.fillRect(0, 0, RENDER_W, 10);
    rctx.fillRect(0, RENDER_H - 10, RENDER_W, 10);
    rctx.restore();
  }

  function drawPlayer() {
    // simple PS1-style “hand” + snowball at bottom center
    const x = RENDER_W * 0.5;
    const y = RENDER_H - 18;

    // glove
    rctx.fillStyle = "#0d2b45";
    rctx.fillRect(x - 14, y - 6, 28, 10);
    rctx.fillStyle = "#1b3a55";
    rctx.fillRect(x - 12, y - 5, 24, 8);

    // snowball in hand
    rctx.fillStyle = "#e6f7ff";
    rctx.fillRect(x - 3, y - 12, 6, 6);

    // charge bar
    if (holding && state === STATE.running) {
      const held = clamp((performance.now() - holdStart) / 900, 0, 1);
      rctx.fillStyle = "rgba(0,0,0,0.35)";
      rctx.fillRect(x - 36, y + 8, 72, 4);
      rctx.fillStyle = "rgba(255,240,120,0.85)";
      rctx.fillRect(x - 36, y + 8, 72 * held, 4);
    }
  }

  function drawCrosshair() {
    // crosshair derived from aim
    const cx = RENDER_W * 0.5 + aim.x * 80;
    const cy = RENDER_H * 0.48 + aim.y * 45;

    rctx.save();
    rctx.globalAlpha = 0.9;
    rctx.fillStyle = "rgba(0,0,0,0.35)";
    rctx.fillRect(cx - 7, cy - 1, 14, 2);
    rctx.fillRect(cx - 1, cy - 7, 2, 14);

    rctx.globalAlpha = 0.9;
    rctx.fillStyle = "rgba(255,255,255,0.85)";
    rctx.fillRect(cx - 6, cy, 12, 1);
    rctx.fillRect(cx, cy - 6, 1, 12);
    rctx.restore();
  }

  function drawTarget(t) {
    const p = toScreen(t);
    const radius = Math.max(2, (t.r * 70) * p.s);

    // outer ring
    rctx.fillStyle = t.kind === "gold" ? "#ffd24a" : "#47b3ff";
    rctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);

    // inner
    rctx.fillStyle = "rgba(255,255,255,0.7)";
    rctx.fillRect(p.x - radius * 0.55, p.y - radius * 0.55, radius * 1.1, radius * 1.1);

    // core
    rctx.fillStyle = "rgba(0,0,0,0.25)";
    rctx.fillRect(p.x - 1, p.y - 1, 2, 2);
  }

  function drawBall(b) {
    const p = toScreen({ x: b.x, y: b.y, z: b.z });
    const s = Math.max(2, 6 * p.s);

    rctx.fillStyle = "#e6f7ff";
    rctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    rctx.fillStyle = "rgba(0,0,0,0.18)";
    rctx.fillRect(p.x - s / 2 + 1, p.y - s / 2 + 1, Math.max(1, s - 2), Math.max(1, s - 2));
  }

  function spawnHitParticles(x, y) {
    for (let i = 0; i < 16; i++) {
      particles.push({
        x,
        y,
        vx: (rand01() * 2 - 1) * 1.2,
        vy: (rand01() * 2 - 1) * 1.2,
        life: 0.45 + rand01() * 0.35,
      });
    }
  }

  function drawParticles() {
    rctx.save();
    rctx.globalAlpha = 0.75;
    rctx.fillStyle = "rgba(255,255,255,0.8)";
    for (const p of particles) {
      rctx.fillRect(p.x | 0, p.y | 0, 1, 1);
    }
    rctx.restore();
  }

  // --- Loop ---
  let last = performance.now();

  function tick(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    if (state === STATE.running) {
      tLeft -= dt;
      if (tLeft <= 0) {
        tLeft = 0;
        endRun();
      }

      // move targets
      for (const t of targets) {
        if (!t.alive) continue;
        t.x += t.vx * dt;
        t.y += t.vy * dt;

        // bounce within bounds
        if (t.x < -0.95 || t.x > 0.95) t.vx *= -1;
        if (t.y < -0.75 || t.y > 0.35) t.vy *= -1;
      }

      // move balls
      for (const b of balls) {
        b.x += b.dx;
        b.y += b.dy;
        b.z += b.dz;

        // slight gravity
        b.dy += 0.0008;
        b.life -= dt;
      }

      // collisions
      for (const b of balls) {
        if (b.life <= 0) continue;
        for (const t of targets) {
          if (!t.alive) continue;

          // collide in pseudo 3D space
          const dx = b.x - t.x;
          const dy = b.y - t.y;
          const dz = b.z - t.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          const rr = (t.r * 0.85) * (t.r * 0.85);

          if (d2 < rr) {
            t.alive = false;
            b.life = 0;

            // scoring
            const base = t.kind === "gold" ? 150 : 100;
            streak = clamp(streak + 1, 0, 999);
            score += base + streak * 8;

            // respawn new one
            spawnTarget(false);

            // particles at screen position
            const ps = toScreen(t);
            spawnHitParticles(ps.x, ps.y);
          }
        }
      }

      // remove dead balls
      balls = balls.filter((b) => b.life > 0 && b.z < 1.2);

      // particle sim
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06;
        p.life -= dt;
      }
      particles = particles.filter((p) => p.life > 0);

      // streak decay if no action (soft)
      if (!holding && balls.length === 0) {
        streak = Math.max(0, streak - dt * 0.4);
      }

      updateHud();
    }

    render();
    requestAnimationFrame(tick);
  }

  function endRun() {
    state = STATE.over;
    uiFinal.textContent = String(Math.max(0, Math.floor(score)));
    showGameOver();
  }

  function render() {
    drawBackground();

    // draw targets sorted by z (far first)
    const aliveTargets = targets.filter((t) => t.alive);
    aliveTargets.sort((a, b) => b.z - a.z);

    for (const t of aliveTargets) drawTarget(t);
    for (const b of balls) drawBall(b);

    drawParticles();
    drawCrosshair();
    drawPlayer();

    drawScanlines();
    drawNoise();

    // upscale to display
    ctx.save();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const dpr = window.devicePixelRatio || 1;
    const cssW = parseFloat(canvas.style.width) || 960;
    const cssH = parseFloat(canvas.style.height) || 540;
    const bw = Math.floor(cssW * dpr);
    const bh = Math.floor(cssH * dpr);

    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
      ctx.imageSmoothingEnabled = false;
    }

    ctx.drawImage(rCanvas, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  // --- Init ---
  function init() {
    state = STATE.idle;
    resetRun();
    overlay.classList.remove("hidden");
    hideGameOver();
    updateHud();
  }

  init();
  requestAnimationFrame(tick);
})();
