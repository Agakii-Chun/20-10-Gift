/* ===== Màn mở đầu: cung tên ===== */
const introScene = document.getElementById("introScene");
const letterApp = document.getElementById("letterApp");
const targetEnvelope = document.getElementById("targetEnvelope");
const introCaption = document.getElementById("introCaption");
const bowAnchor = document.getElementById("bowAnchor");
const bowRig = document.getElementById("bowRig");
const bowShadow = document.getElementById("bowShadow");
const bowBody = document.getElementById("bowBody");
const bowGrip = document.getElementById("bowGrip");
const bowString = document.getElementById("bowString");
const rigArrow = document.getElementById("rigArrow");
const flyingArrow = document.getElementById("flyingArrow");

const PROMPT = "Move to aim · hold to draw the bow · release to shoot ♡";
const REST_Y = 14;        // vị trí dây cung khi chưa kéo
const ARROW_LEN = 58;     // chiều dài mũi tên
const MAX_PULL = 36;      // độ kéo dây tối đa (px)
const CHARGE_MS = 650;    // thời gian giữ chuột để kéo căng cung
const MIN_CHARGE = 0.22;  // kéo quá nhẹ thì không bắn
const MAX_ANGLE = 85;     // chỉ cho xoay trong nửa trên

let state = "idle";       // idle | drawing | flying | done
let aim = -18;            // góc hiện tại (độ, 0 = hướng lên, dương = sang phải)
let aimTarget = -18;
let pointerMoved = false;
let charge = 0;
let pull = 0;
let vib = null;           // rung dây cung sau khi thả
let hasArrow = true;
let misses = 0;
let lastTime = performance.now();
let rafId = 0;

const easeOut = (t) => 1 - (1 - t) * (1 - t);

function showLetterApp() {
  cancelAnimationFrame(rafId);
  introScene.style.display = "none";
  letterApp.classList.remove("letter-app-hidden");
}

function pivotPoint() {
  const r = bowAnchor.getBoundingClientRect();
  return { x: r.left, y: r.top };
}

function updateAimTarget(clientX, clientY) {
  const p = pivotPoint();
  const dx = clientX - p.x;
  const dy = clientY - p.y;
  if (Math.hypot(dx, dy) < 12) return;
  const a = Math.atan2(dx, -dy) * 180 / Math.PI;
  aimTarget = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, a));
}

function renderBow(now) {
  let s = pull;
  if (vib) {
    const t = now - vib.t0;
    if (t > 450) vib = null;
    else s = vib.amp * Math.exp(-t / 110) * Math.cos(t * 0.06);
  }
  const flex = Math.max(0, s);
  const tipX = 24 - flex * 0.12;
  const tipY = REST_Y + flex * 0.22;
  const ctrlY = -52 + flex * 0.25;
  const d = `M ${-tipX} ${tipY} Q 0 ${ctrlY} ${tipX} ${tipY}`;
  bowShadow.setAttribute("d", d);
  bowBody.setAttribute("d", d);
  bowGrip.setAttribute("y", 0.5 * tipY + 0.5 * ctrlY - 3.5);
  bowString.setAttribute("points", `${-tipX},${tipY} 0,${REST_Y + s} ${tipX},${tipY}`);
  rigArrow.setAttribute("transform", `translate(0 ${REST_Y + s - ARROW_LEN})`);
  rigArrow.style.display = hasArrow ? "" : "none";
  bowRig.setAttribute("transform", `rotate(${aim})`);
}

function frame(now) {
  const dt = Math.min(50, now - lastTime);
  lastTime = now;

  if (!pointerMoved && state === "idle") {
    aimTarget = -18 + Math.sin(now / 700) * 6; // lắc nhẹ cho tới khi chuột chạm vào
  }
  if (state !== "flying" && state !== "done") {
    aim += (aimTarget - aim) * (1 - Math.pow(1e-5, dt / 1000));
  }

  if (state === "drawing") charge = Math.min(1, charge + dt / CHARGE_MS);
  else if (charge > 0 && state !== "flying") charge = Math.max(0, charge - dt / 180);
  pull = easeOut(charge) * MAX_PULL;

  renderBow(now);
  rafId = requestAnimationFrame(frame);
}

/* ----- Bắn ----- */
function shoot() {
  state = "flying";
  const pullAtRelease = pull;
  hasArrow = false;
  vib = { t0: performance.now(), amp: pullAtRelease };
  charge = 0;
  pull = 0;
  introCaption.textContent = "";

  const sr = introScene.getBoundingClientRect();
  const ox = sr.left + introScene.clientLeft;
  const oy = sr.top + introScene.clientTop;
  const pv = pivotPoint();
  const P = { x: pv.x - ox, y: pv.y - oy };
  const th = aim * Math.PI / 180;
  const dir = { x: Math.sin(th), y: -Math.cos(th) };
  const tipDist = ARROW_LEN - REST_Y - pullAtRelease;
  const tip0 = { x: P.x + dir.x * tipDist, y: P.y + dir.y * tipDist };

  const er = targetEnvelope.getBoundingClientRect();
  const E = { x: er.left + er.width / 2 - ox, y: er.top + er.height / 2 - oy + 6 };

  // Trúng nếu hướng bắn lệch khỏi phong thư trong một khoảng dung sai (rộng dần sau mỗi lần trượt)
  const vx = E.x - P.x;
  const vy = E.y - P.y;
  const thc = Math.atan2(vx, -vy) * 180 / Math.PI;
  const half = Math.atan((er.width / 2 + 20 + misses * 20) / Math.hypot(vx, vy)) * 180 / Math.PI;
  const hit = Math.abs(aim - thc) <= half;

  let P1, C, duration;
  if (hit) {
    const len = Math.hypot(E.x - tip0.x, E.y - tip0.y);
    P1 = E;
    C = { x: tip0.x + dir.x * len * 0.55, y: tip0.y + dir.y * len * 0.55 };
    duration = Math.max(320, Math.min(700, len / 0.9));
  } else {
    P1 = { x: tip0.x + dir.x * 950, y: tip0.y + dir.y * 950 };
    C = { x: (tip0.x + P1.x) / 2, y: (tip0.y + P1.y) / 2 };
    duration = 860;
  }

  flyingArrow.style.display = "block";
  flyingArrow.style.opacity = "1";
  const t0 = performance.now();

  function step(now) {
    const s = Math.min(1, (now - t0) / duration);
    const u = 1 - s;
    const x = u * u * tip0.x + 2 * u * s * C.x + s * s * P1.x;
    const y = u * u * tip0.y + 2 * u * s * C.y + s * s * P1.y;
    const vx2 = 2 * u * (C.x - tip0.x) + 2 * s * (P1.x - C.x);
    const vy2 = 2 * u * (C.y - tip0.y) + 2 * s * (P1.y - C.y);
    const ang = Math.atan2(vx2, -vy2) * 180 / Math.PI;
    flyingArrow.style.transform = `translate(${x}px, ${y}px) rotate(${ang}deg)`;
    if (!hit && s > 0.7) flyingArrow.style.opacity = String(1 - (s - 0.7) / 0.3);
    if (s < 1) {
      requestAnimationFrame(step);
    } else {
      hit ? onHit() : onMiss();
    }
  }
  requestAnimationFrame(step);
}

function onHit() {
  state = "done";
  introCaption.textContent = "A little surprise for you... ♡";
  targetEnvelope.classList.add("is-hit");
  setTimeout(() => {
    introScene.classList.add("is-hit");
    setTimeout(showLetterApp, 600);
  }, 500);
}

function onMiss() {
  misses++;
  flyingArrow.style.display = "none";
  introCaption.textContent = "So close! Try again ♡";
  setTimeout(() => {
    hasArrow = true;
    state = "idle";
  }, 400);
  setTimeout(() => {
    if (state === "idle") introCaption.textContent = PROMPT;
  }, 1600);
}

/* ----- Chuột / cảm ứng ----- */
introScene.addEventListener("pointermove", (event) => {
  if (state === "flying" || state === "done") return;
  pointerMoved = true;
  updateAimTarget(event.clientX, event.clientY);
});

introScene.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || state !== "idle" || !hasArrow) return;
  event.preventDefault();
  try { introScene.setPointerCapture(event.pointerId); } catch (e) {}
  pointerMoved = true;
  updateAimTarget(event.clientX, event.clientY);
  state = "drawing";
  charge = 0;
  vib = null;
  introCaption.textContent = "Aim... and release to shoot! ♡";
});

introScene.addEventListener("pointerup", (event) => {
  if (event.button !== 0 || state !== "drawing") return;
  if (charge < MIN_CHARGE) {
    state = "idle";
    introCaption.textContent = PROMPT;
  } else {
    shoot();
  }
});

function cancelDraw() {
  if (state !== "drawing") return;
  state = "idle";
  introCaption.textContent = PROMPT;
}
introScene.addEventListener("pointercancel", cancelDraw);
introScene.addEventListener("lostpointercapture", cancelDraw);

rafId = requestAnimationFrame(frame);

function resetIntro() {
  state = "idle";
  aim = aimTarget = -18;
  pointerMoved = false;
  charge = 0;
  pull = 0;
  vib = null;
  hasArrow = true;
  misses = 0;
  flyingArrow.style.display = "none";
  targetEnvelope.classList.remove("is-hit");
  introScene.classList.remove("is-hit");
  introScene.style.display = "";
  introCaption.textContent = PROMPT;
  letterApp.classList.add("letter-app-hidden");
  lastTime = performance.now();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(frame);
}

/* ===== Phần thư (giữ nguyên) ===== */
const noBtn = document.getElementById("noBtn");
const yesBtn = document.getElementById("yesBtn");
const proposal = document.getElementById("proposal");
const success = document.getElementById("success");
const hint = document.getElementById("hint");

let noCount = 0;

function dodgeNo() {
  noCount++;

  const lines = [
    "Tút chắc tưa? 🥺",
    "Nghĩ kĩ lại iiiii! 💗",
    "Chăc của chắc của chắc chưaaaa?",
    "Đừng màaaaaaa 🙈",
    "Chỉ được chọn YES thuii!"
  ];

  hint.textContent = lines[Math.min(noCount - 1, lines.length - 1)];

  const dx = Math.round((Math.random() - 0.5) * 110);
  const dy = Math.round((Math.random() - 0.5) * 70);
  noBtn.style.transform = `translate(${dx}px, ${dy}px)`;

  if (noCount >= 3) {
    noBtn.textContent = "umm...";
  }
}

noBtn.addEventListener("mouseenter", dodgeNo);
noBtn.addEventListener("click", dodgeNo);

yesBtn.addEventListener("click", () => {
  proposal.style.display = "none";
  success.style.display = "flex";
  hint.textContent = "Best. Answer. Ever. 💞";

  for (let i = 0; i < 35; i++) {
    setTimeout(makeHeart, i * 90);
  }
});

document.getElementById("againBtn").addEventListener("click", () => {
  success.style.display = "none";
  proposal.style.display = "block";
  noCount = 0;
  noBtn.textContent = "NO";
  noBtn.style.transform = "";
  hint.textContent = "I made this little page just for you ♡";
  resetIntro();
});

function makeHeart() {
  const heart = document.createElement("span");
  heart.className = "heart";
  heart.textContent = ["💗", "💖", "💕", "♥", "💘"][
    Math.floor(Math.random() * 5)
  ];
  heart.style.left = Math.random() * 100 + "vw";
  heart.style.animationDuration = (3 + Math.random() * 3) + "s";
  heart.style.fontSize = (15 + Math.random() * 20) + "px";

  document.body.appendChild(heart);
  setTimeout(() => heart.remove(), 6500);
}
