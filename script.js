const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = {
  I: "#00f0f0",
  O: "#f0f000",
  T: "#a000f0",
  S: "#00f000",
  Z: "#f00000",
  J: "#0050f0",
  L: "#f0a000",
};

const SHAPES = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
};

const LINE_SCORES = [0, 100, 300, 500, 800];

const boardCanvas = document.getElementById("board");
const ctx = boardCanvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");
const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const startBtn = document.getElementById("start");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlay-text");

let board;
let piece;
let nextPiece;
let score;
let lines;
let level;
let dropInterval;
let dropCounter;
let lastTime;
let running = false;
let paused = false;
let animationId;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPiece() {
  const types = Object.keys(SHAPES);
  const type = types[Math.floor(Math.random() * types.length)];
  const shape = SHAPES[type].map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor((COLS - shape[0].length) / 2),
    y: type === "I" ? -1 : 0,
  };
}

function collides(shape, offsetX, offsetY) {
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (!shape[y][x]) continue;
      const bx = offsetX + x;
      const by = offsetY + y;
      if (bx < 0 || bx >= COLS || by >= ROWS) return true;
      if (by >= 0 && board[by][bx]) return true;
    }
  }
  return false;
}

function rotate(shape) {
  // 시계 방향 90도 회전
  return shape[0].map((_, i) => shape.map((row) => row[i]).reverse());
}

function tryRotate() {
  const rotated = rotate(piece.shape);
  // 벽에 붙어 있을 때 회전이 막히지 않도록 좌우로 밀어보는 간단한 월킥
  for (const kick of [0, -1, 1, -2, 2]) {
    if (!collides(rotated, piece.x + kick, piece.y)) {
      piece.shape = rotated;
      piece.x += kick;
      return;
    }
  }
}

function move(dir) {
  if (!collides(piece.shape, piece.x + dir, piece.y)) {
    piece.x += dir;
  }
}

function softDrop() {
  if (!collides(piece.shape, piece.x, piece.y + 1)) {
    piece.y++;
    score += 1;
  } else {
    lockPiece();
  }
  dropCounter = 0;
}

function hardDrop() {
  while (!collides(piece.shape, piece.x, piece.y + 1)) {
    piece.y++;
    score += 2;
  }
  lockPiece();
  dropCounter = 0;
}

function lockPiece() {
  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (!piece.shape[y][x]) continue;
      const by = piece.y + y;
      if (by < 0) {
        gameOver();
        return;
      }
      board[by][piece.x + x] = piece.type;
    }
  }
  clearLines();
  spawnPiece();
}

function clearLines() {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every((cell) => cell)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(null));
      cleared++;
      y++; // 같은 줄을 다시 검사
    }
  }
  if (cleared > 0) {
    lines += cleared;
    score += LINE_SCORES[cleared] * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 100);
  }
  updateStats();
}

function spawnPiece() {
  piece = nextPiece;
  nextPiece = randomPiece();
  drawNext();
  if (collides(piece.shape, piece.x, piece.y)) {
    gameOver();
  }
}

function updateStats() {
  scoreEl.textContent = score;
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, color, size = BLOCK) {
  context.fillStyle = color;
  context.fillRect(x * size, y * size, size, size);
  context.strokeStyle = "rgba(0, 0, 0, 0.4)";
  context.lineWidth = 2;
  context.strokeRect(x * size + 1, y * size + 1, size - 2, size - 2);
}

function drawGrid() {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 1;
  for (let x = 1; x < COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * BLOCK, 0);
    ctx.lineTo(x * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let y = 1; y < ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * BLOCK);
    ctx.lineTo(COLS * BLOCK, y * BLOCK);
    ctx.stroke();
  }
}

function getGhostY() {
  let ghostY = piece.y;
  while (!collides(piece.shape, piece.x, ghostY + 1)) ghostY++;
  return ghostY;
}

function draw() {
  ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
  drawGrid();

  board.forEach((row, y) =>
    row.forEach((cell, x) => {
      if (cell) drawBlock(ctx, x, y, COLORS[cell]);
    })
  );

  if (!piece) return;

  // 고스트(떨어질 위치 미리보기)
  const ghostY = getGhostY();
  ctx.globalAlpha = 0.25;
  piece.shape.forEach((row, y) =>
    row.forEach((cell, x) => {
      if (cell) drawBlock(ctx, piece.x + x, ghostY + y, COLORS[piece.type]);
    })
  );
  ctx.globalAlpha = 1;

  piece.shape.forEach((row, y) =>
    row.forEach((cell, x) => {
      if (cell && piece.y + y >= 0) {
        drawBlock(ctx, piece.x + x, piece.y + y, COLORS[piece.type]);
      }
    })
  );
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const size = 24;
  const shape = nextPiece.shape;
  const offsetX = (nextCanvas.width / size - shape[0].length) / 2;
  const offsetY = (nextCanvas.height / size - shape.length) / 2;
  shape.forEach((row, y) =>
    row.forEach((cell, x) => {
      if (cell) drawBlock(nextCtx, offsetX + x, offsetY + y, COLORS[nextPiece.type], size);
    })
  );
}

function update(time = 0) {
  if (!running) return;
  const delta = time - lastTime;
  lastTime = time;

  if (!paused) {
    dropCounter += delta;
    if (dropCounter > dropInterval) {
      if (!collides(piece.shape, piece.x, piece.y + 1)) {
        piece.y++;
      } else {
        lockPiece();
      }
      dropCounter = 0;
    }
  }

  if (running) {
    draw();
    animationId = requestAnimationFrame(update);
  }
}

function showOverlay(text) {
  overlayText.textContent = text;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function startGame() {
  cancelAnimationFrame(animationId);
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  dropInterval = 1000;
  dropCounter = 0;
  lastTime = performance.now();
  running = true;
  paused = false;
  nextPiece = randomPiece();
  spawnPiece();
  updateStats();
  hideOverlay();
  startBtn.textContent = "다시 시작";
  startBtn.blur();
  animationId = requestAnimationFrame(update);
}

function gameOver() {
  running = false;
  draw();
  showOverlay("GAME OVER");
}

function togglePause() {
  paused = !paused;
  if (paused) {
    showOverlay("PAUSED");
  } else {
    hideOverlay();
  }
}

document.addEventListener("keydown", (e) => {
  if (!running) return;

  if (e.code === "KeyP") {
    togglePause();
    return;
  }
  if (paused) return;

  switch (e.code) {
    case "ArrowLeft":
      move(-1);
      break;
    case "ArrowRight":
      move(1);
      break;
    case "ArrowDown":
      softDrop();
      break;
    case "ArrowUp":
      tryRotate();
      break;
    case "Space":
      hardDrop();
      break;
    default:
      return;
  }
  e.preventDefault();
  if (running) {
    updateStats();
    draw();
  }
});

startBtn.addEventListener("click", startGame);

// 초기 화면
board = createBoard();
draw();
