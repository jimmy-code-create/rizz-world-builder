/**
 * BREAKOUT — pure simulation, no canvas in sight.
 *
 * Positions are normalised (x across the width, y down the height) so the same
 * physics works on a phone in portrait, a fullscreen monitor and a small panel
 * beside the call. Only the ball radius is converted to pixels for collisions.
 */

export const BRICK_COLS = 8;
export const BRICK_ROWS = 5;
const PADDLE_HALF = 0.11;
const BALL_RADIUS = 0.018;
const BRICK_TOP = 0.09;
const BRICK_HEIGHT = 0.035;

export type BreakoutState = {
  paddleX: number;
  ball: { x: number; y: number; vx: number; vy: number };
  /** 1 = alive, 0 = broken. */
  bricks: number[];
  lives: number;
  score: number;
  level: number;
  launched: boolean;
  over: boolean;
  won: boolean;
  hits: number;
};

export type BreakoutInput = {
  dt: number;
  /** Paddle target as a normalised x, or null to keep the current position. */
  paddleX: number | null;
  keys: Set<string>;
  launch: boolean;
  width: number;
  height: number;
};

export function createBreakout(level = 1): BreakoutState {
  const bricks = new Array(BRICK_COLS * BRICK_ROWS).fill(1);
  // Later levels start with gaps so the board is not solved by holding still.
  if (level > 1) {
    for (let i = 0; i < bricks.length; i += 1) {
      if ((i * 7 + level * 3) % 11 === 0) bricks[i] = 0;
    }
  }
  return {
    paddleX: 0.5,
    ball: { x: 0.5, y: 0.8, vx: 0.34, vy: -0.52 },
    bricks,
    lives: 3,
    score: 0,
    level,
    launched: false,
    over: false,
    won: false,
    hits: 0,
  };
}

export function bricksLeft(state: BreakoutState): number {
  return state.bricks.filter(Boolean).length;
}

export function stepBreakout(state: BreakoutState, input: BreakoutInput) {
  if (state.over || state.won) return;
  const { dt, keys, width, height } = input;
  const radiusX = BALL_RADIUS;
  const radiusY = (BALL_RADIUS * width) / height;

  // ---- paddle -------------------------------------------------------------
  if (input.paddleX !== null) state.paddleX = input.paddleX;
  if (keys.has("arrowleft") || keys.has("a")) state.paddleX -= dt * 1.5;
  if (keys.has("arrowright") || keys.has("d")) state.paddleX += dt * 1.5;
  state.paddleX = Math.min(1 - PADDLE_HALF, Math.max(PADDLE_HALF, state.paddleX));

  const ball = state.ball;
  if (!state.launched) {
    ball.x = state.paddleX;
    ball.y = 0.86;
    if (input.launch || keys.has(" ") || keys.has("enter")) state.launched = true;
    return;
  }

  // ---- ball ---------------------------------------------------------------
  const previousX = ball.x;
  const previousY = ball.y;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.x < radiusX) {
    ball.x = radiusX;
    ball.vx = Math.abs(ball.vx);
  } else if (ball.x > 1 - radiusX) {
    ball.x = 1 - radiusX;
    ball.vx = -Math.abs(ball.vx);
  }
  if (ball.y < radiusY) {
    ball.y = radiusY;
    ball.vy = Math.abs(ball.vy);
  }

  // ---- bricks -------------------------------------------------------------
  const column = Math.floor(ball.x * BRICK_COLS);
  const row = Math.floor((ball.y - BRICK_TOP) / BRICK_HEIGHT);
  if (row >= 0 && row < BRICK_ROWS && column >= 0 && column < BRICK_COLS) {
    const index = row * BRICK_COLS + column;
    if (state.bricks[index]) {
      state.bricks[index] = 0;
      state.score += 10 * state.level;
      state.hits += 1;
      // Which axis bounced is decided by where the ball came from, so a corner
      // hit does not flip both axes and stick the ball inside the wall.
      const cameFromSide = Math.abs(previousX - ball.x) > Math.abs(previousY - ball.y);
      if (cameFromSide) ball.vx = -ball.vx;
      else ball.vy = -ball.vy;
      // Speed the ball up a little as the wall thins out.
      const speed = Math.hypot(ball.vx, ball.vy);
      const target = Math.min(1.5, speed * 1.015);
      ball.vx = (ball.vx / speed) * target;
      ball.vy = (ball.vy / speed) * target;
      if (bricksLeft(state) === 0) {
        state.won = true;
        return;
      }
    }
  }

  // ---- paddle -------------------------------------------------------------
  const paddleTop = 0.9;
  if (ball.vy > 0 && ball.y + radiusY >= paddleTop && ball.y < paddleTop + 0.12) {
    const offset = ball.x - state.paddleX;
    if (Math.abs(offset) <= PADDLE_HALF + radiusX) {
      ball.y = paddleTop - radiusY;
      ball.vy = -Math.abs(ball.vy);
      ball.vx += (offset / PADDLE_HALF) * 0.35;
      const speed = Math.min(1.5, Math.hypot(ball.vx, ball.vy) * 1.01);
      ball.vx = (ball.vx / Math.hypot(ball.vx, ball.vy)) * speed;
      ball.vy = (ball.vy / Math.hypot(ball.vx, ball.vy)) * speed;
      state.hits += 1;
    }
  }

  ball.vx = Math.max(-1.2, Math.min(1.2, ball.vx));

  // ---- lost ball ----------------------------------------------------------
  if (ball.y > 1 + radiusY) {
    state.lives -= 1;
    state.launched = false;
    ball.x = state.paddleX;
    ball.y = 0.86;
    ball.vx = 0.34;
    ball.vy = -0.52;
    if (state.lives <= 0) state.over = true;
  }
}

export function nextLevel(state: BreakoutState): BreakoutState {
  const next = createBreakout(state.level + 1);
  next.score = state.score;
  next.lives = state.lives;
  next.launched = false;
  return next;
}
