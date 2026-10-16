import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { ArcadeChip, useArcade, type ArcadeStats } from "@/components/games/use-arcade";

/**
 * PIXEL ARENA — an agar/.io-style blob arena that runs entirely in the page.
 *
 * The whole game is one canvas and one mutable world object held in a ref: the
 * frame loop reads it, nothing re-renders while it runs. React only sees the
 * HUD numbers (throttled by useArcade) and the "you were eaten" card.
 */

const ARENA = 2600;
const PELLET_COUNT = 320;
const START_MASS = 22;
const BOT_COLORS = ["#5ad8ff", "#ffb347", "#ff6b9d", "#c084fc", "#7dd3fc", "#f4f1e7", "#b6f36b"];
const BOT_NAMES = [
  "nibble",
  "orbit",
  "munch",
  "zigzag",
  "blip",
  "kernel",
  "pixel",
  "dodge",
  "vortex",
];
const BEST_KEY = "rizz:arcade:pixel-arena:best";

export type Blob = {
  x: number;
  y: number;
  mass: number;
  color: string;
  name: string;
  bot: boolean;
  alive: boolean;
  respawnAt: number;
  /** Seconds until this bot rethinks its target. */
  think: number;
  aimX: number;
  aimY: number;
};

type Pellet = { x: number; y: number; color: string };

export type World = {
  player: Blob;
  bots: Blob[];
  pellets: Pellet[];
  camera: { x: number; y: number };
  zoom: number;
  best: number;
  eatenBy: string;
  deadUntil: number;
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const radiusOf = (mass: number) => 10 + Math.sqrt(Math.max(1, mass)) * 2.2;
const speedOf = (mass: number) => Math.max(95, 250 * Math.pow(START_MASS / Math.max(1, mass), 0.4));

function readBest(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(BEST_KEY);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) ? value : 0;
}

function makeBlob(bot: boolean, index: number, mass = START_MASS): Blob {
  return {
    x: rand(120, ARENA - 120),
    y: rand(120, ARENA - 120),
    mass,
    color: bot ? BOT_COLORS[index % BOT_COLORS.length] : "#c9ff3d",
    name: bot ? BOT_NAMES[index % BOT_NAMES.length] : "you",
    bot,
    alive: true,
    respawnAt: 0,
    think: 0,
    aimX: 0,
    aimY: 0,
  };
}

function spreadPellets(pellets: Pellet[]) {
  while (pellets.length < PELLET_COUNT) {
    pellets.push({
      x: rand(30, ARENA - 30),
      y: rand(30, ARENA - 30),
      color: BOT_COLORS[Math.floor(Math.random() * BOT_COLORS.length)],
    });
  }
}

export function createWorld(botCount: number): World {
  const pellets: Pellet[] = [];
  spreadPellets(pellets);
  const bots = Array.from({ length: botCount }, (_, index) => makeBlob(true, index, rand(18, 34)));
  const player = makeBlob(false, 0);
  return {
    player,
    bots,
    pellets,
    camera: { x: player.x, y: player.y },
    zoom: 1,
    best: readBest(),
    eatenBy: "",
    deadUntil: 0,
  };
}

function respawnBlob(blob: Blob, mass: number) {
  blob.x = rand(160, ARENA - 160);
  blob.y = rand(160, ARENA - 160);
  blob.mass = mass;
  blob.alive = true;
}

export function stepBot(world: World, bot: Blob, dt: number) {
  const me = radiusOf(bot.mass);
  bot.think -= dt;
  if (bot.think <= 0) {
    bot.think = rand(0.22, 0.5);
    let threat: Blob | null = null;
    let prey: Blob | null = null;
    let threatDistance = Infinity;
    let preyDistance = Infinity;

    for (const other of [world.player, ...world.bots]) {
      if (other === bot || !other.alive) continue;
      const distance = Math.hypot(other.x - bot.x, other.y - bot.y);
      if (other.mass > bot.mass * 1.15 && distance < 340 && distance < threatDistance) {
        threat = other;
        threatDistance = distance;
      } else if (bot.mass > other.mass * 1.15 && distance < 320 && distance < preyDistance) {
        prey = other;
        preyDistance = distance;
      }
    }

    if (threat) {
      // Run straight away from the bigger blob.
      bot.aimX = bot.x - (threat.x - bot.x);
      bot.aimY = bot.y - (threat.y - bot.y);
    } else if (prey) {
      bot.aimX = prey.x;
      bot.aimY = prey.y;
    } else {
      let nearest: Pellet | null = null;
      let nearestDistance = Infinity;
      for (const pellet of world.pellets) {
        const distance = Math.hypot(pellet.x - bot.x, pellet.y - bot.y);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = pellet;
        }
      }
      if (nearest) {
        bot.aimX = nearest.x;
        bot.aimY = nearest.y;
      } else {
        bot.aimX = rand(100, ARENA - 100);
        bot.aimY = rand(100, ARENA - 100);
      }
    }
  }

  const dx = bot.aimX - bot.x;
  const dy = bot.aimY - bot.y;
  const length = Math.hypot(dx, dy) || 1;
  const speed = speedOf(bot.mass);
  bot.x += (dx / length) * speed * dt;
  bot.y += (dy / length) * speed * dt;
  // Soft walls: bots turn back instead of parking in a corner.
  bot.x = Math.min(ARENA - me, Math.max(me, bot.x));
  bot.y = Math.min(ARENA - me, Math.max(me, bot.y));
}

function consume(world: World, eater: Blob, target: Blob) {
  eater.mass += target.mass * 0.85;
  if (target.bot) {
    target.alive = false;
    target.respawnAt = 2.2;
  } else {
    world.eatenBy = eater.name;
    world.deadUntil = 1.6;
  }
}

export function PixelArena({
  players = 1,
  fullscreen = false,
}: {
  players?: number;
  fullscreen?: boolean;
}) {
  const botCount = Math.min(9, 4 + Math.max(1, players));
  const worldRef = useRef<World | null>(null);
  const [round, setRound] = useState(0);
  const [dead, setDead] = useState(false);

  useEffect(() => {
    worldRef.current = createWorld(botCount);
    setDead(false);
  }, [round, botCount]);

  const { canvasRef, stats, pointerHandlers } = useArcade((frame, next: ArcadeStats) => {
    let world = worldRef.current;
    if (!world) {
      world = createWorld(botCount);
      worldRef.current = world;
    }
    const { ctx, width, height, dt, keys } = frame;
    const player = world.player;

    // ---- input -------------------------------------------------------------
    let aimX = 0;
    let aimY = 0;
    if (keys.has("arrowleft") || keys.has("a")) aimX -= 1;
    if (keys.has("arrowright") || keys.has("d")) aimX += 1;
    if (keys.has("arrowup") || keys.has("w")) aimY -= 1;
    if (keys.has("arrowdown") || keys.has("s")) aimY += 1;
    const keyDriven = aimX !== 0 || aimY !== 0;
    if (keyDriven) {
      const length = Math.hypot(aimX, aimY) || 1;
      player.x += (aimX / length) * speedOf(player.mass) * dt;
      player.y += (aimY / length) * speedOf(player.mass) * dt;
    } else if (frame.pointer.inside) {
      // Point at the cursor: the blob always chases where you are pointing.
      const worldX = world.camera.x + (frame.pointer.x - width / 2) / world.zoom;
      const worldY = world.camera.y + (frame.pointer.y - height / 2) / world.zoom;
      const dx = worldX - player.x;
      const dy = worldY - player.y;
      const length = Math.hypot(dx, dy);
      if (length > 4) {
        const speed = speedOf(player.mass);
        player.x += (dx / length) * speed * dt;
        player.y += (dy / length) * speed * dt;
      }
    }
    const playerRadius = radiusOf(player.mass);
    player.x = Math.min(ARENA - playerRadius, Math.max(playerRadius, player.x));
    player.y = Math.min(ARENA - playerRadius, Math.max(playerRadius, player.y));

    // ---- world -------------------------------------------------------------
    for (const bot of world.bots) {
      if (!bot.alive) {
        bot.respawnAt -= dt;
        if (bot.respawnAt <= 0) respawnBlob(bot, rand(18, 30));
        continue;
      }
      stepBot(world, bot, dt);
    }

    // Eat pellets: only the player and the bots grow, and every eaten pixel
    // respawns immediately somewhere else so the arena never empties.
    if (!dead) {
      for (let i = 0; i < world.pellets.length; i += 1) {
        const pellet = world.pellets[i];
        if (Math.hypot(pellet.x - player.x, pellet.y - player.y) < playerRadius + 6) {
          player.mass += 1;
          pellet.x = rand(30, ARENA - 30);
          pellet.y = rand(30, ARENA - 30);
        }
        for (const bot of world.bots) {
          if (!bot.alive) continue;
          const botRadius = radiusOf(bot.mass);
          if (Math.hypot(pellet.x - bot.x, pellet.y - bot.y) < botRadius + 6) {
            bot.mass += 1;
            pellet.x = rand(30, ARENA - 30);
            pellet.y = rand(30, ARENA - 30);
          }
        }
      }
    }

    const everything = [player, ...world.bots];
    for (let i = 0; i < everything.length; i += 1) {
      const a = everything[i];
      if (!a.alive || (a === player && dead)) continue;
      const aRadius = radiusOf(a.mass);
      for (let j = 0; j < everything.length; j += 1) {
        const b = everything[j];
        if (a === b || !b.alive) continue;
        if (b === player && dead) continue;
        if (a.mass <= b.mass * 1.15) continue;
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (distance < aRadius - radiusOf(b.mass) * 0.35) {
          consume(world, a, b);
          if (b === player) {
            setDead(true);
            if (a.mass > world.best) {
              world.best = Math.round(a.mass - START_MASS);
              try {
                window.localStorage.setItem(BEST_KEY, String(world.best));
              } catch {
                /* private mode */
              }
            }
          }
        }
      }
    }

    if (dead) {
      world.deadUntil -= dt;
      if (world.deadUntil <= 0) {
        respawnBlob(player, START_MASS);
        setDead(false);
      }
    }

    // ---- camera + render ---------------------------------------------------
    world.zoom = Math.min(1.15, Math.max(0.5, Math.pow(28 / radiusOf(player.mass), 0.5)));
    world.camera.x += (player.x - world.camera.x) * Math.min(1, dt * 6);
    world.camera.y += (player.y - world.camera.y) * Math.min(1, dt * 6);

    ctx.fillStyle = "#08080a";
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(
      width / 2 - world.camera.x * world.zoom,
      height / 2 - world.camera.y * world.zoom,
    );
    ctx.scale(world.zoom, world.zoom);

    // Arena floor: a pixel grid, drawn only where it can be seen.
    const halfW = width / 2 / world.zoom;
    const halfH = height / 2 / world.zoom;
    const minX = Math.max(0, world.camera.x - halfW);
    const maxX = Math.min(ARENA, world.camera.x + halfW);
    const minY = Math.max(0, world.camera.y - halfH);
    const maxY = Math.min(ARENA, world.camera.y + halfH);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let x = Math.floor(minX / 90) * 90; x < maxX; x += 90) {
      for (let y = Math.floor(minY / 90) * 90; y < maxY; y += 90) {
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      }
    }
    ctx.strokeStyle = "rgba(201,255,61,0.28)";
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, ARENA, ARENA);

    for (const pellet of world.pellets) {
      if (
        pellet.x < minX - 10 ||
        pellet.x > maxX + 10 ||
        pellet.y < minY - 10 ||
        pellet.y > maxY + 10
      )
        continue;
      ctx.fillStyle = pellet.color;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.arc(pellet.x, pellet.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const drawBlob = (blob: Blob) => {
      if (!blob.alive) return;
      const radius = radiusOf(blob.mass);
      ctx.beginPath();
      ctx.arc(blob.x, blob.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = blob.color;
      ctx.globalAlpha = blob === player ? 0.95 : 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = blob === player ? 4 : 2;
      ctx.strokeStyle = blob === player ? "#f4f1e7" : "rgba(255,255,255,0.35)";
      ctx.stroke();
      ctx.font = `600 ${Math.max(12, radius * 0.5)}px "Instrument Sans", sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = blob === player ? "#0a0a0b" : "rgba(10,10,11,0.75)";
      ctx.fillText(blob.name, blob.x, blob.y + Math.max(4, radius * 0.18));
    };
    world.bots.forEach(drawBlob);
    if (!dead) drawBlob(player);
    ctx.restore();

    // ---- HUD bridge --------------------------------------------------------
    const ranking = [player, ...world.bots]
      .filter((blob) => blob.alive)
      .sort((a, b) => b.mass - a.mass);
    next.size = Math.max(0, Math.round(player.mass - START_MASS));
    next.best = world.best;
    next.rank = `#${Math.max(1, ranking.indexOf(player) + 1)}/${ranking.length}`;
    next.eatenBy = world.eatenBy;
  });

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#08080a]">
      <canvas
        ref={canvasRef}
        {...pointerHandlers}
        className="h-full w-full touch-none select-none"
        style={{ touchAction: "none" }}
        aria-label="Pixel Arena game area"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-center gap-1.5 p-2">
        <ArcadeChip label="size" value={Number(stats.size ?? 0)} accent="#c9ff3d" />
        <ArcadeChip label="best" value={Number(stats.best ?? 0)} />
        <ArcadeChip label="rank" value={String(stats.rank ?? "#1")} />
        {!fullscreen && (
          <span className="ml-auto rounded-lg border border-white/10 bg-black/45 px-2 py-1 text-[10px] font-semibold text-white/60 backdrop-blur">
            Mouse, WASD or drag to steer
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setRound((value) => value + 1)}
        className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-[11px] font-semibold text-white/70 backdrop-blur transition hover:text-white"
      >
        <RotateCcw className="h-3.5 w-3.5" /> New arena
      </button>

      {dead && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="rounded-2xl border border-white/10 bg-black/70 px-5 py-4 text-center backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">Eaten</p>
            <p className="mt-1 font-display text-lg font-bold text-[#f4f1e7]">
              {stats.eatenBy ? `${stats.eatenBy} got you` : "You were eaten"}
            </p>
            <p className="mt-0.5 text-xs text-white/60">Respawning…</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default PixelArena;
