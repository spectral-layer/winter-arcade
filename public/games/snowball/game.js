/* Snowball Frenzy
   - Canvas draws ONLY entities (player/targets/balls/aim), no background paint
   - Background is handled by CSS (.bg layers)
   - Mobile: drag to aim, hold to charge, release to throw
   - Fullscreen is handled by index.html
   - Posts score to parent: { type:"WINTER_ARCADE_SCORE", game:"snowball", score }
   - Adds: music loop + SFX + red outline on snowballs for visibility
*/

(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: true });

  // UI
  const uiScore = document.getElementById("uiScore");
  const uiTime = document.getElementById("uiTime");
  const uiStreak = document.getElementById("uiStreak");
  const uiFinal = document.getElementById("uiFinal");

  const overlay = document.getElementById("overlay");
  const gameover = document.getElementById("gameover");

  const btnStart = document.getElementById("btnStart");
  const btnRestart = document.getElementById("btnRestart");
  const btnPlayAgain = document.getElementById("btnPlayAgain");
  const btnSend = document.getElementById("btnSend");
  const btnSound = document.getElementById("btnSound");
  const btnExit = document.getElementById("btnExit");

  // Helpers
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const now = () => performance.now();
  const rand = (a, b) => a + Math.random() * (b - a);

  // =========================
  // AUDIO (music + SFX)
  // =========================
  let soundOn = true;

  // music element (mp3 loop)
  const music = new Audio("assets/music.mp3");
  music.loop = true;
  music.preload = "auto";
  music.volume = 0.45;

  // WebAudio for SFX (beeps)
  let audioCtx = null;
  function ensureAudio() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    } catch (_) {}
  }

  function sfx(freq = 440, dur = 0.06, type = "triangle", gain = 0.07) {
    if (!soundOn) return;
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;

    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();

    o.type = type;
    o.frequency.setValueAtTime(freq, t0);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    o.connect(g).connect(audioCtx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  async function playMusic() {
    if (!soundOn) return;
    try {
      music.muted = false;
      await music.play();
    } catch (_) {
      // mobile may block if not in a user gesture; Start click is a gesture so usually ok
    }
  }
  function stopMusic() {
    try {
      music.pause();
      music.currentTime = 0;
    } catch (_) {}
  }

  function applySoundUi() {
    btnSound.textContent = soundOn ? "🔊 Sound" : "🔇 Muted";
    music.muted = !soundOn;
    if (!soundOn) {
      // stop music when muted (cleaner)
      try { music.pause(); } catch (_) {}
    }
  }

  btnSound?.addEventListener("click", () => {
    soundOn = !soundOn;
    ensureAudio();
    applySoundUi();
    sfx(soundOn ? 880 : 220, 0.07, "triangle", 0.08);
    if (soundOn && running && !ended) playMusic();
  });

  // =========================
  // Responsive canvas
  // =========================
  let DPR = 1;
  let W = 960,
    H = 540;

  function resize() {
    DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();
    W = Math.max(320, Math.floor(rect.width));
    H = Math.max(240, Math.floor(rect.height));
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize);

  // =========================
  // Game state
  // =========================
  let running = false;
  let ended = false;
  let startTs = 0;
  let lastTs = 0;

  const ROUND_SECONDS = 30;
  let timeLeft = ROUND_SECONDS;

  let score = 0;
  let streak = 0;

  // Aim / throw
  const pointer = {
    down: false,
    id: null,
    x: 0,
    y: 0,
    aimX: 0,
    aimY: 0,
    charge: 0,
    charging: false,
  };

  // Player
  const player = { x: 0, y: 0 };

  // Snowballs
  const balls = [];
  const BALL_SPEED_MIN = 780;
  const BALL_SPEED_MAX = 1200;

  // Targets (horizontal movers)
  const targets = [];
  const TARGET_ROWS = 3;

  function spawnTargets() {
    targets.length = 0;
    const laneYs = [];
    for (let i = 0; i < TARGET_ROWS; i++) {
      laneYs.push(lerp(H * 0.22, H * 0.5, i / (TARGET_ROWS - 1)));
    }

    const count = 6;
    for (let i = 0; i < count; i++) {
      const lane = i % TARGET_ROWS;
      const dir = Math.random() < 0.5 ? -1 : 1;
      targets.push({
        lane,
        x: rand(W * 0.45, W * 0.95),
        y: laneYs[lane],
        r: rand(20, 26),
        vx: rand(90, 170) * dir,
        wobble: rand(0, 10),
        hitFlash: 0,
      });
    }
  }

  function syncUI() {
    uiScore.textContent = String(Math.floor(score));
    uiTime.textContent = String(Math.ceil(timeLeft));
    uiStreak.textContent = String(Math.floor(streak));
  }

  function resetGame() {
    running = false;
    ended = false;
    startTs = 0;
    lastTs = 0;

    timeLeft = ROUND_SECONDS;
    score = 0;
    streak = 0;

    balls.length = 0;

    player.x = W * 0.12;
    player.y = H * 0.78;

    pointer.down = false;
    pointer.id = null;
    pointer.x = player.x;
    pointer.y = player.y;
    pointer.aimX = W * 0.55;
    pointer.aimY = H * 0.25;
    pointer.charge = 0;
    pointer.charging = false;

    spawnTargets();
    syncUI();

    overlay.classList.remove("hidden");
    gameover.classList.add("hidden");

    ctx.clearRect(0, 0, W, H);
  }

  // =========================
  // Input
  // =========================
  function getCanvasPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onPointerDown(e) {
    if (!running || ended) return;
    if (pointer.down) return;

    pointer.down = true;
    pointer.id = e.pointerId;
    canvas.setPointerCapture?.(e.pointerId);

    const p = getCanvasPos(e);
    pointer.x = p.x;
    pointer.y = p.y;
    pointer.aimX = p.x;
    pointer.aimY = p.y;

    pointer.charging = true;
    pointer.charge = 0;

    // subtle "charge start" tick
    ensureAudio();
    sfx(520, 0.035, "triangle", 0.05);
  }

  function onPointerMove(e) {
    if (!running || ended) return;
    if (!pointer.down || e.pointerId !== pointer.id) return;

    const p = getCanvasPos(e);
    pointer.x = p.x;
    pointer.y = p.y;
    pointer.aimX = p.x;
    pointer.aimY = p.y;
  }

  function throwBall() {
    const dx = pointer.aimX - player.x;
    const dy = pointer.aimY - player.y;
    const len = Math.hypot(dx, dy) || 1;

    const nx = dx / len;
    const ny = dy / len;

    const speed = lerp(BALL_SPEED_MIN, BALL_SPEED_MAX, pointer.charge);

    balls.push({
      x: player.x,
      y: player.y,
      vx: nx * speed,
      vy: ny * speed,
      r: 10,
      life: 1.6,
      trail: [],
      hit: false,
    });

    // throw sound
    ensureAudio();
    const p = clamp(pointer.charge, 0, 1);
    sfx(520 + 420 * p, 0.05, "triangle", 0.09);
  }

  function onPointerUp(e) {
    if (!running || ended) return;
    if (!pointer.down || e.pointerId !== pointer.id) return;

    pointer.down = false;
    pointer.id = null;

    if (pointer.charging) {
      throwBall();
      pointer.charging = false;
      pointer.charge = 0;
    }
  }

  canvas.addEventListener("pointerdown", onPointerDown, { passive: true });
  canvas.addEventListener("pointermove", onPointerMove, { passive: true });
  canvas.addEventListener("pointerup", onPointerUp, { passive: true });
  canvas.addEventListener("pointercancel", onPointerUp, { passive: true });

  // =========================
  // Buttons
  // =========================
  btnStart?.addEventListener("click", async () => {
    // audio must start after user gesture
    ensureAudio();
    applySoundUi();
    sfx(880, 0.06, "triangle", 0.09);

    overlay.classList.add("hidden");
    gameover.classList.add("hidden");

    running = true;
    ended = false;
    startTs = now();
    lastTs = startTs;

    // start music loop
    await playMusic();

    tick();
  });

  function stopAllAudio() {
    stopMusic();
    // no need to close audio ctx; keep it for SFX
  }

  btnRestart?.addEventListener("click", async () => {
    stopAllAudio();
    resetGame();
  });

  btnPlayAgain?.addEventListener("click", async () => {
    stopAllAudio();
    resetGame();
  });

  btnExit?.addEventListener("click", async () => {
    stopAllAudio();
    // index.html already exits fullscreen; here we just notify parent (optional)
    try {
      window.parent?.postMessage({ type: "WINTER_ARCADE_EXIT", game: "snowball" }, "*");
    } catch (_) {}
  });

  btnSend?.addEventListener("click", () => {
    try {
      window.parent?.postMessage(
        { type: "WINTER_ARCADE_SCORE", game: "snowball", score: Math.floor(score) },
        "*"
      );
    } catch (_) {}
    ensureAudio();
    sfx(980, 0.05, "triangle", 0.09);
    setTimeout(() => sfx(740, 0.05, "triangle", 0.08), 70);
  });

  // =========================
  // Draw
  // =========================
  function drawPlayer() {
    // pinguino più in basso
    const x = player.x;
    const y = player.y + 26;

    ctx.save();

    // Shadow
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(x, y + 30, 44, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // BODY
    ctx.fillStyle = "#1F2A37";
    ctx.beginPath();
    ctx.ellipse(x, y + 6, 30, 36, 0, 0, Math.PI * 2);
    ctx.fill();

    // BELLY
    ctx.fillStyle = "#EAF2FF";
    ctx.beginPath();
    ctx.ellipse(x, y + 14, 20, 26, 0, 0, Math.PI * 2);
    ctx.fill();

    // HEAD
    ctx.fillStyle = "#1F2A37";
    ctx.beginPath();
    ctx.ellipse(x, y - 26, 22, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // FACE PATCH
    ctx.fillStyle = "#F7FBFF";
    ctx.beginPath();
    ctx.ellipse(x, y - 24, 16, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // EYES
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.arc(x - 6, y - 26, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 6, y - 26, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // highlights
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(x - 5.2, y - 27, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 6.8, y - 27, 0.9, 0, Math.PI * 2);
    ctx.fill();

    // BEAK
    ctx.fillStyle = "#FFB020";
    ctx.beginPath();
    ctx.moveTo(x, y - 22);
    ctx.lineTo(x - 6, y - 16);
    ctx.lineTo(x + 6, y - 16);
    ctx.closePath();
    ctx.fill();

    // CHEEKS
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#FF5B7A";
    ctx.beginPath();
    ctx.arc(x - 10, y - 20, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 10, y - 20, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // FLIPPERS
    ctx.fillStyle = "#1F2A37";
    ctx.beginPath();
    ctx.ellipse(x - 28, y + 8, 14, 8, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 28, y + 8, 14, 8, 0.35, 0, Math.PI * 2);
    ctx.fill();

    // FEET
    ctx.fillStyle = "#FFB020";
    ctx.beginPath();
    ctx.ellipse(x - 12, y + 40, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 12, y + 40, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // snowball "in hand"
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(x - 44, y + 6, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x - 44, y + 6, 8.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function drawTarget(t) {
    const x = t.x,
      y = t.y,
      r = t.r;

    ctx.save();

    // shadow
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(x, y + r * 1.05, r * 1.1, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // bubble
    const bubble = ctx.createRadialGradient(
      x - r * 0.3,
      y - r * 0.3,
      r * 0.2,
      x,
      y,
      r * 1.3
    );
    bubble.addColorStop(0, "rgba(80,190,255,0.55)");
    bubble.addColorStop(1, "rgba(20,120,200,0.18)");
    ctx.fillStyle = bubble;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.25, 0, Math.PI * 2);
    ctx.fill();

    // face
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.arc(x - r * 0.25, y - r * 0.12, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + r * 0.25, y - r * 0.12, 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,80,110,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.35, y + r * 0.22);
    ctx.lineTo(x + r * 0.35, y + r * 0.22);
    ctx.stroke();

    if (t.hitFlash > 0) {
      ctx.globalAlpha = t.hitFlash;
      ctx.strokeStyle = "rgba(255,220,90,0.95)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(x, y, r * (1.55 + (1 - t.hitFlash) * 0.4), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  // ✅ snowballs with red outline
  function drawBalls() {
    for (const b of balls) {
      b.trail.unshift({ x: b.x, y: b.y });
      if (b.trail.length > 10) b.trail.pop();

      ctx.save();

      // trail
      for (let i = 0; i < b.trail.length; i++) {
        const p = b.trail[i];
        const a = (1 - i / b.trail.length) * 0.18;
        const rr = b.r * (0.95 - i * 0.05);

        ctx.globalAlpha = a;

        // red outline (soft)
        ctx.strokeStyle = "rgba(255,60,60,0.85)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rr + 1.5, 0, Math.PI * 2);
        ctx.stroke();

        // fill
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
        ctx.fill();
      }

      // main ball
      ctx.globalAlpha = 1;

      // outline
      ctx.strokeStyle = "rgba(255,60,60,0.95)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 1.5, 0, Math.PI * 2);
      ctx.stroke();

      // fill
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();

      // tiny highlight
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.restore();
    }
  }

  function drawAim() {
    if (!pointer.down || !pointer.charging) return;

    const ax = pointer.aimX;
    const ay = pointer.aimY;

    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(ax, ay);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(255,220,90,0.95)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(ax, ay, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // =========================
  // Update / Render
  // =========================
  function endRound() {
    if (ended) return;
    ended = true;
    running = false;

    // stop music at game over (clean)
    stopMusic();

    uiFinal.textContent = String(Math.floor(score));
    gameover.classList.remove("hidden");

    ensureAudio();
    sfx(420, 0.08, "triangle", 0.09);
    setTimeout(() => sfx(210, 0.12, "sine", 0.06), 120);
  }

  function update(dt) {
    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      endRound();
      return;
    }

    if (pointer.down && pointer.charging) {
      pointer.charge = clamp(pointer.charge + dt * 0.85, 0, 1);

      // light “charging” tick every ~0.25s
      if (soundOn && audioCtx) {
        if (!pointer._tick) pointer._tick = 0;
        pointer._tick += dt;
        if (pointer._tick > 0.28) {
          pointer._tick = 0;
          sfx(220 + 140 * pointer.charge, 0.02, "sine", 0.03);
        }
      }
    }

    // targets
    for (const t of targets) {
      t.wobble += dt * 3.2;
      t.x += t.vx * dt;
      t.y += Math.sin(t.wobble) * dt * 6;

      if (t.x < W * 0.3) {
        t.x = W * 0.3;
        t.vx *= -1;
      }
      if (t.x > W * 0.96) {
        t.x = W * 0.96;
        t.vx *= -1;
      }

      if (t.hitFlash > 0) t.hitFlash = Math.max(0, t.hitFlash - dt * 3.2);
    }

    // balls
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      // cartoon arc gravity
      b.vy += 520 * dt;

      if (
        b.life <= 0 ||
        b.x < -60 ||
        b.x > W + 60 ||
        b.y < -120 ||
        b.y > H + 120
      ) {
        if (!b.hit) {
          streak = Math.max(0, streak - 1);
          ensureAudio();
          sfx(180, 0.07, "sawtooth", 0.05);
        }
        balls.splice(i, 1);
        continue;
      }

      for (const t of targets) {
        const dx = b.x - t.x;
        const dy = b.y - t.y;
        const d = Math.hypot(dx, dy);
        if (d < b.r + t.r * 1.1) {
          b.hit = true;

          streak += 1;
          const base = 50;
          const bonus = Math.min(250, Math.floor(streak) * 20);
          score += base + bonus;

          t.hitFlash = 1;
          t.x = rand(W * 0.55, W * 0.96);
          t.vx = (Math.random() < 0.5 ? -1 : 1) * rand(90, 170);

          // hit sfx
          ensureAudio();
          sfx(760, 0.05, "triangle", 0.09);
          setTimeout(() => sfx(980, 0.04, "triangle", 0.07), 55);

          balls.splice(i, 1);
          break;
        }
      }
    }

    syncUI();
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    for (const t of targets) drawTarget(t);
    drawAim();
    drawBalls();
    drawPlayer();
  }

  function tick() {
    if (!running) return;

    const t = now();
    const dt = Math.min(0.033, (t - lastTs) / 1000);
    lastTs = t;

    update(dt);
    render();

    requestAnimationFrame(tick);
  }

  // =========================
  // Boot
  // =========================
  resize();
  applySoundUi();
  resetGame();
})();
