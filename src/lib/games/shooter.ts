/**
 * NEON VOID — a vertical space shooter, simulation only.
 *
 * Normalised space again (x across, y down), so it plays the same everywhere.
 * The ship fires on its own once you hold the trigger, enemies arrive in waves
 * that get faster and denser, and every number here is plain so the rules can be
 * stepped headlessly in the check script.
 */

export type Enemy = { x: number; y: number; vy: number; hp: number; wobble: number };
export type Bullet = { x: number; y: number; vy: number };
export type ShooterState = {
  shipX: number;
  bullets: Bullet[];
  enemies: Enemy[];
  score: number;
  lives: number;
  wave: number;
  cooldown: number;
  spawnTimer: number;
  over: boolean;
  best: number;
  elapsed: number;
};

export type ShooterInput = {
  dt: number;
  shipX: number | null;
  keys: Set<string>;
  firing: boolean;
};

export const SHIP_HALF = 0.055;

function readBest(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem("rizz:arcade:neon-void:best");
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) ? value : 0;
}

export function createShooter(): ShooterState {
  return {
    shipX: 0.5,
    bullets: [],
    enemies: [],
    score: 0,
    lives: 3,
    wave: 1,
    cooldown: 0,
    spawnTimer: 0.6,
    over: false,
    best: readBest(),
    elapsed: 0,
  };
}

export function startWave(state: ShooterState) {
  state.wave += 1;
  state.spawnTimer = Math.max(0.22, 0.9 - state.wave * 0.07);
}

function spawnEnemy(state: ShooterState, random = Math.random) {
  const lane = Math.floor(random() * 5) / 4; // 0, 0.25, 0.5, 0.75, 1
  state.enemies.push({
    x: lane,
    y: -0.05,
    vy: 0.11 + state.wave * 0.012 + random() * 0.03,
    hp: state.wave >= 4 && random() < 0.25 ? 2 : 1,
    wobble: random() * Math.PI * 2,
  });
}

export function stepShooter(state: ShooterState, input: ShooterInput, random = Math.random) {
  if (state.over) return;
  const { dt, keys } = input;
  state.elapsed += dt;

  // ---- ship ---------------------------------------------------------------
  if (input.shipX !== null) state.shipX = input.shipX;
  if (keys.has("arrowleft") || keys.has("a")) state.shipX -= dt * 1.3;
  if (keys.has("arrowright") || keys.has("d")) state.shipX += dt * 1.3;
  state.shipX = Math.min(1 - SHIP_HALF, Math.max(SHIP_HALF, state.shipX));

  // ---- firing -------------------------------------------------------------
  state.cooldown -= dt;
  if (input.firing && state.cooldown <= 0) {
    state.cooldown = 0.16;
    state.bullets.push({ x: state.shipX, y: 0.88, vy: -1.5 });
  }

  for (const bullet of state.bullets) bullet.y += bullet.vy * dt;
  state.bullets = state.bullets.filter((bullet) => bullet.y > -0.05);

  // ---- enemies ------------------------------------------------------------
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnEnemy(state, random);
    state.spawnTimer = Math.max(0.2, 0.95 - state.wave * 0.07) * (0.6 + random() * 0.8);
  }

  for (const enemy of state.enemies) {
    enemy.y += enemy.vy * dt;
    enemy.wobble += dt * 3;
    enemy.x += Math.sin(enemy.wobble) * dt * 0.05;
  }

  // ---- collisions ---------------------------------------------------------
  const survivors: Enemy[] = [];
  for (const enemy of state.enemies) {
    let alive = true;
    for (let i = 0; i < state.bullets.length; i += 1) {
      const bullet = state.bullets[i];
      if (!bullet) continue;
      if (Math.abs(bullet.x - enemy.x) < SHIP_HALF && Math.abs(bullet.y - enemy.y) < 0.045) {
        state.bullets.splice(i, 1);
        enemy.hp -= 1;
        if (enemy.hp <= 0) {
          alive = false;
          state.score += 10 * state.wave;
          if (state.score > state.best) {
            state.best = state.score;
            try {
              window.localStorage.setItem("rizz:arcade:neon-void:best", String(state.best));
            } catch {
              /* private mode */
            }
          }
        }
        break;
      }
    }
    if (alive && enemy.y > 1.02) {
      state.lives -= 1;
      alive = false;
      if (state.lives <= 0) state.over = true;
    }
    if (alive) survivors.push(enemy);
  }
  state.enemies = survivors;

  // Reaching a score milestone starts the next wave.
  if (state.score >= state.wave * 120) startWave(state);
}
