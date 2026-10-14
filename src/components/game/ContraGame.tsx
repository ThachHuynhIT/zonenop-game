"use client";

import { useEffect, useRef, useCallback, useState } from "react";

// ═══════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════
interface Vec2 { x: number; y: number; }
interface Rect { x: number; y: number; w: number; h: number; }

interface Bullet {
  x: number; y: number; vx: number; vy: number;
  owner: "player" | "enemy"; damage: number; life: number; type: string;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; size: number;
  shape?: "circle" | "square" | "spark";
  rotation?: number; rotSpeed?: number;
}

interface PowerUp {
  x: number; y: number; w: number; h: number;
  type: "S" | "M" | "R" | "L" | "B" | "F"; vy: number; life: number;
}

interface Enemy {
  x: number; y: number; w: number; h: number;
  type: string; hp: number; maxHp: number;
  vx: number; vy: number; dir: number;
  state: string; timer: number; shootTimer: number;
  animFrame: number; grounded: boolean;
  patrol?: { left: number; right: number };
  data?: Record<string, number>;
}

interface Platform {
  x: number; y: number; w: number; h: number;
  type: "solid" | "bridge" | "destructible" | "moving" | "spike";
  hp?: number; moveDx?: number; moveRange?: number; moveOriginX?: number;
  color?: string;
}

interface LevelData {
  name: string; width: number; bgColor: string;
  bgType: "jungle" | "base" | "waterfall" | "snow" | "alien";
  platforms: Platform[]; enemies: Enemy[]; powerUps: PowerUp[];
  bossAt?: number;
}

interface Player {
  x: number; y: number; w: number; h: number;
  vx: number; vy: number; dir: number; aimDir: Vec2;
  grounded: boolean; jumping: boolean; shooting: boolean; prone: boolean;
  weapon: string; weaponTimer: number;
  hp: number; maxHp: number; lives: number; score: number;
  invincible: number; animFrame: number; animTimer: number;
  swimming: boolean; dead: boolean; respawnTimer: number;
}

// ═══════════════════════════════════════════════════
// CONSTANTS — increased jump, lowered platform gaps
// ═══════════════════════════════════════════════════
const CANVAS_W = 800;
const CANVAS_H = 480;
const GRAVITY = 0.48;
const PLAYER_SPEED = 3.5;
const JUMP_FORCE = -11.5; // much stronger jump
const TILE = 32;
// Fixed simulation step (ms) — decouples game physics from display refresh rate.
const FIXED_DT = 1000 / 60;
const MAX_FRAME_DELTA = 250; // clamp huge gaps (tab was backgrounded/lagged) to avoid a "spiral of death"
// Keys the game actually cares about — only these get preventDefault(), and only without a modifier held.
const GAME_KEYS = new Set([
  "arrowleft", "arrowright", "arrowup", "arrowdown",
  "a", "d", "w", "s", " ", "j", "z", "x", "enter", "escape",
]);

const WEAPON_DATA: Record<string, { rate: number; speed: number; damage: number; spread: number; count: number; color: string }> = {
  default: { rate: 12, speed: 8, damage: 1, spread: 0, count: 1, color: "#FFFF00" },
  M: { rate: 5, speed: 10, damage: 1, spread: 0, count: 1, color: "#FF8800" },
  S: { rate: 10, speed: 7, damage: 1, spread: 15, count: 5, color: "#FF4444" },
  L: { rate: 18, speed: 6, damage: 3, spread: 0, count: 1, color: "#4488FF" },
  R: { rate: 4, speed: 12, damage: 2, spread: 0, count: 1, color: "#FF00FF" },
  F: { rate: 8, speed: 5, damage: 2, spread: 8, count: 3, color: "#FF6600" },
};

const POWERUP_COLORS: Record<string, { bg: string; fg: string; glow: string }> = {
  S: { bg: "#FF4444", fg: "#FFF", glow: "rgba(255,68,68,0.4)" },
  M: { bg: "#FF8800", fg: "#FFF", glow: "rgba(255,136,0,0.4)" },
  R: { bg: "#FF00FF", fg: "#FFF", glow: "rgba(255,0,255,0.4)" },
  L: { bg: "#4488FF", fg: "#FFF", glow: "rgba(68,136,255,0.4)" },
  F: { bg: "#FF6600", fg: "#FFF", glow: "rgba(255,102,0,0.4)" },
  B: { bg: "#00DDFF", fg: "#FFF", glow: "rgba(0,221,255,0.4)" },
};

// ═══════════════════════════════════════════════════
// LEVEL GENERATION — Platforms reachable, max gap ~70px
// ═══════════════════════════════════════════════════
function createLevels(): LevelData[] {
  return [
    // ── LEVEL 1: JUNGLE ──
    {
      name: "STAGE 1 - JUNGLE",
      width: 6400,
      bgColor: "#0a1a0a",
      bgType: "jungle",
      platforms: [
        ...Array.from({ length: 200 }, (_, i) => ({
          x: i * TILE, y: 448, w: TILE, h: TILE, type: "solid" as const, color: "#3a5a0a"
        })),
        // Platforms — kept close to ground, max 70px step up
        { x: 200, y: 380, w: 140, h: 16, type: "solid" as const },
        { x: 400, y: 370, w: 120, h: 16, type: "bridge" as const },
        { x: 600, y: 380, w: 140, h: 16, type: "solid" as const },
        { x: 850, y: 370, w: 120, h: 16, type: "solid" as const },
        { x: 1050, y: 380, w: 160, h: 16, type: "solid" as const },
        { x: 1300, y: 370, w: 120, h: 16, type: "bridge" as const },
        { x: 1500, y: 380, w: 140, h: 16, type: "solid" as const },
        { x: 1750, y: 370, w: 120, h: 16, type: "solid" as const },
        { x: 1950, y: 380, w: 160, h: 16, type: "solid" as const },
        { x: 2200, y: 370, w: 120, h: 16, type: "bridge" as const },
        { x: 2400, y: 380, w: 140, h: 16, type: "solid" as const },
        { x: 2650, y: 370, w: 120, h: 16, type: "solid" as const },
        { x: 2850, y: 380, w: 160, h: 16, type: "solid" as const },
        { x: 3100, y: 370, w: 120, h: 16, type: "solid" as const },
        { x: 3300, y: 380, w: 140, h: 16, type: "bridge" as const },
        { x: 3550, y: 370, w: 120, h: 16, type: "solid" as const },
        { x: 3750, y: 380, w: 160, h: 16, type: "solid" as const },
        { x: 4000, y: 370, w: 120, h: 16, type: "solid" as const },
        { x: 4200, y: 380, w: 140, h: 16, type: "bridge" as const },
        { x: 4450, y: 370, w: 160, h: 16, type: "solid" as const },
        // Walls/barriers — short, jumpable
        { x: 1000, y: 410, w: 32, h: 38, type: "destructible" as const, hp: 5 },
        { x: 2000, y: 410, w: 32, h: 38, type: "destructible" as const, hp: 5 },
        { x: 3000, y: 410, w: 32, h: 38, type: "destructible" as const, hp: 5 },
        { x: 4800, y: 410, w: 32, h: 38, type: "destructible" as const, hp: 5 },
        // Boss area
        { x: 5600, y: 320, w: 32, h: 128, type: "solid" as const },
        { x: 5600, y: 320, w: 800, h: 32, type: "solid" as const },
      ],
      enemies: [
        ...createSoldiers(300, 416, 4, 500),
        ...createSoldiers(900, 416, 3, 400),
        ...createSoldiers(1300, 416, 3, 400),
        ...createSoldiers(1800, 416, 3, 400),
        ...createSoldiers(2300, 416, 4, 500),
        ...createSoldiers(2800, 416, 3, 400),
        ...createSoldiers(3300, 416, 3, 400),
        ...createSoldiers(3800, 416, 4, 500),
        ...createSoldiers(4300, 416, 3, 400),
        createSniper(420, 338),
        createSniper(1060, 348),
        createSniper(1760, 338),
        createSniper(2660, 338),
        createSniper(3560, 338),
        createTurret(1800, 416),
        createTurret(2800, 416),
        createTurret(3800, 416),
        createTurret(5000, 416),
        createBoss(6000, 340, "jungle_boss"),
      ],
      powerUps: [
        createPowerUp(410, 330, "S"),
        createPowerUp(1310, 330, "M"),
        createPowerUp(2210, 330, "R"),
        createPowerUp(3310, 340, "L"),
        createPowerUp(4460, 330, "F"),
      ],
      bossAt: 5600,
    },
    // ── LEVEL 2: BASE ──
    {
      name: "STAGE 2 - ENEMY BASE",
      width: 5600,
      bgColor: "#0a0a1a",
      bgType: "base",
      platforms: [
        ...Array.from({ length: 175 }, (_, i) => ({
          x: i * TILE, y: 448, w: TILE, h: TILE, type: "solid" as const, color: "#2a2a3a"
        })),
        { x: 100, y: 390, w: 200, h: 16, type: "solid" as const },
        { x: 350, y: 380, w: 160, h: 16, type: "solid" as const },
        { x: 580, y: 390, w: 160, h: 16, type: "solid" as const },
        { x: 800, y: 380, w: 200, h: 16, type: "solid" as const },
        { x: 1050, y: 390, w: 160, h: 16, type: "solid" as const },
        { x: 1280, y: 380, w: 140, h: 16, type: "bridge" as const },
        { x: 1480, y: 390, w: 200, h: 16, type: "solid" as const },
        { x: 1730, y: 380, w: 160, h: 16, type: "solid" as const },
        { x: 1950, y: 390, w: 140, h: 16, type: "solid" as const },
        { x: 2150, y: 380, w: 200, h: 16, type: "solid" as const },
        { x: 2400, y: 390, w: 160, h: 16, type: "bridge" as const },
        { x: 2620, y: 380, w: 140, h: 16, type: "solid" as const },
        { x: 2820, y: 390, w: 200, h: 16, type: "solid" as const },
        { x: 3070, y: 380, w: 160, h: 16, type: "solid" as const },
        { x: 3280, y: 390, w: 140, h: 16, type: "solid" as const },
        { x: 3480, y: 380, w: 200, h: 16, type: "bridge" as const },
        { x: 3730, y: 390, w: 160, h: 16, type: "solid" as const },
        { x: 3950, y: 380, w: 140, h: 16, type: "solid" as const },
        // Spike traps — narrow
        { x: 750, y: 442, w: 48, h: 6, type: "spike" as const },
        { x: 1400, y: 442, w: 48, h: 6, type: "spike" as const },
        { x: 2300, y: 442, w: 48, h: 6, type: "spike" as const },
        { x: 3200, y: 442, w: 48, h: 6, type: "spike" as const },
        // Destructible walls — short
        { x: 900, y: 410, w: 32, h: 38, type: "destructible" as const, hp: 8 },
        { x: 1800, y: 410, w: 32, h: 38, type: "destructible" as const, hp: 8 },
        { x: 2700, y: 410, w: 32, h: 38, type: "destructible" as const, hp: 8 },
        { x: 3600, y: 410, w: 32, h: 38, type: "destructible" as const, hp: 8 },
        // Boss area
        { x: 4800, y: 320, w: 32, h: 128, type: "solid" as const },
        { x: 4800, y: 320, w: 800, h: 32, type: "solid" as const },
      ],
      enemies: [
        ...createSoldiers(200, 416, 4, 400),
        ...createSoldiers(700, 416, 4, 400),
        ...createSoldiers(1200, 416, 4, 400),
        ...createSoldiers(1700, 416, 4, 400),
        ...createSoldiers(2200, 416, 4, 400),
        ...createSoldiers(2700, 416, 4, 400),
        ...createSoldiers(3200, 416, 4, 400),
        ...createSoldiers(3700, 416, 4, 400),
        createSniper(360, 348),
        createSniper(810, 348),
        createSniper(1290, 348),
        createSniper(1740, 348),
        createSniper(2160, 348),
        createSniper(2630, 348),
        createSniper(3080, 348),
        createSniper(3740, 348),
        createTurret(600, 416),
        createTurret(1400, 416),
        createTurret(2200, 416),
        createTurret(3000, 416),
        createTurret(3800, 416),
        createShieldSoldier(1600, 416),
        createShieldSoldier(2800, 416),
        createShieldSoldier(3500, 416),
        createBoss(5200, 340, "base_boss"),
      ],
      powerUps: [
        createPowerUp(360, 340, "M"),
        createPowerUp(1060, 350, "S"),
        createPowerUp(1740, 340, "L"),
        createPowerUp(2410, 350, "R"),
        createPowerUp(3490, 340, "F"),
      ],
      bossAt: 4800,
    },
    // ── LEVEL 3: WATERFALL ──
    {
      name: "STAGE 3 - WATERFALL",
      width: 5600,
      bgColor: "#051525",
      bgType: "waterfall",
      platforms: [
        ...Array.from({ length: 175 }, (_, i) => ({
          x: i * TILE, y: 448, w: TILE, h: TILE, type: "solid" as const, color: "#1a3a2a"
        })),
        // Stepped platforms — max 60px step up each
        { x: 100, y: 390, w: 140, h: 16, type: "solid" as const },
        { x: 300, y: 380, w: 120, h: 16, type: "bridge" as const },
        { x: 500, y: 370, w: 140, h: 16, type: "solid" as const },
        { x: 700, y: 380, w: 120, h: 16, type: "bridge" as const },
        { x: 900, y: 390, w: 140, h: 16, type: "solid" as const },
        { x: 1100, y: 380, w: 120, h: 16, type: "bridge" as const },
        { x: 1300, y: 390, w: 140, h: 16, type: "solid" as const },
        { x: 1500, y: 380, w: 120, h: 16, type: "solid" as const },
        { x: 1700, y: 370, w: 140, h: 16, type: "bridge" as const },
        { x: 1900, y: 380, w: 120, h: 16, type: "solid" as const },
        { x: 2100, y: 390, w: 140, h: 16, type: "solid" as const },
        { x: 2300, y: 380, w: 120, h: 16, type: "bridge" as const },
        { x: 2500, y: 370, w: 140, h: 16, type: "solid" as const },
        { x: 2700, y: 380, w: 120, h: 16, type: "solid" as const },
        { x: 2900, y: 390, w: 140, h: 16, type: "solid" as const },
        { x: 3100, y: 380, w: 120, h: 16, type: "bridge" as const },
        { x: 3300, y: 370, w: 140, h: 16, type: "solid" as const },
        { x: 3500, y: 380, w: 120, h: 16, type: "solid" as const },
        { x: 3700, y: 390, w: 140, h: 16, type: "solid" as const },
        { x: 3900, y: 380, w: 120, h: 16, type: "bridge" as const },
        // Moving platforms
        { x: 600, y: 390, w: 80, h: 16, type: "moving" as const, moveDx: 1.2, moveRange: 100, moveOriginX: 600 },
        { x: 1600, y: 390, w: 80, h: 16, type: "moving" as const, moveDx: -1.2, moveRange: 100, moveOriginX: 1600 },
        { x: 2600, y: 390, w: 80, h: 16, type: "moving" as const, moveDx: 1.2, moveRange: 100, moveOriginX: 2600 },
        { x: 3600, y: 390, w: 80, h: 16, type: "moving" as const, moveDx: -1.2, moveRange: 100, moveOriginX: 3600 },
        // Boss area
        { x: 4800, y: 320, w: 32, h: 128, type: "solid" as const },
        { x: 4800, y: 320, w: 800, h: 32, type: "solid" as const },
      ],
      enemies: [
        ...createSoldiers(250, 416, 4, 400),
        ...createSoldiers(750, 416, 4, 400),
        ...createSoldiers(1250, 416, 5, 500),
        ...createSoldiers(1750, 416, 4, 400),
        ...createSoldiers(2250, 416, 5, 500),
        ...createSoldiers(2750, 416, 4, 400),
        ...createSoldiers(3250, 416, 5, 500),
        ...createSoldiers(3750, 416, 4, 400),
        createSniper(310, 348),
        createSniper(710, 348),
        createSniper(1110, 348),
        createSniper(1510, 348),
        createSniper(1910, 348),
        createSniper(2310, 348),
        createSniper(2710, 348),
        createSniper(3110, 348),
        createSniper(3510, 348),
        createTurret(600, 416),
        createTurret(1400, 416),
        createTurret(2200, 416),
        createTurret(3000, 416),
        createTurret(3800, 416),
        createJumper(800, 416),
        createJumper(1600, 416),
        createJumper(2400, 416),
        createJumper(3200, 416),
        createJumper(4100, 416),
        createBoss(5200, 340, "waterfall_boss"),
      ],
      powerUps: [
        createPowerUp(510, 330, "S"),
        createPowerUp(1110, 340, "R"),
        createPowerUp(1710, 330, "M"),
        createPowerUp(2510, 330, "L"),
        createPowerUp(3310, 330, "F"),
      ],
      bossAt: 4800,
    },
    // ── LEVEL 4: SNOW ──
    {
      name: "STAGE 4 - SNOW FIELD",
      width: 6000,
      bgColor: "#101830",
      bgType: "snow",
      platforms: [
        ...Array.from({ length: 188 }, (_, i) => ({
          x: i * TILE, y: 448, w: TILE, h: TILE, type: "solid" as const, color: "#c0c8d8"
        })),
        { x: 200, y: 390, w: 160, h: 16, type: "solid" as const },
        { x: 430, y: 380, w: 140, h: 16, type: "solid" as const },
        { x: 640, y: 370, w: 160, h: 16, type: "bridge" as const },
        { x: 870, y: 380, w: 140, h: 16, type: "solid" as const },
        { x: 1080, y: 390, w: 160, h: 16, type: "solid" as const },
        { x: 1310, y: 380, w: 140, h: 16, type: "solid" as const },
        { x: 1520, y: 370, w: 160, h: 16, type: "bridge" as const },
        { x: 1750, y: 380, w: 140, h: 16, type: "solid" as const },
        { x: 1960, y: 390, w: 160, h: 16, type: "solid" as const },
        { x: 2190, y: 380, w: 140, h: 16, type: "solid" as const },
        { x: 2400, y: 370, w: 160, h: 16, type: "bridge" as const },
        { x: 2630, y: 380, w: 140, h: 16, type: "solid" as const },
        { x: 2840, y: 390, w: 160, h: 16, type: "solid" as const },
        { x: 3070, y: 380, w: 140, h: 16, type: "solid" as const },
        { x: 3280, y: 370, w: 160, h: 16, type: "bridge" as const },
        { x: 3510, y: 380, w: 140, h: 16, type: "solid" as const },
        { x: 3720, y: 390, w: 160, h: 16, type: "solid" as const },
        { x: 3950, y: 380, w: 140, h: 16, type: "solid" as const },
        { x: 4160, y: 370, w: 160, h: 16, type: "bridge" as const },
        { x: 4390, y: 380, w: 140, h: 16, type: "solid" as const },
        // Spike traps — narrow
        { x: 800, y: 442, w: 48, h: 6, type: "spike" as const },
        { x: 1500, y: 442, w: 48, h: 6, type: "spike" as const },
        { x: 2350, y: 442, w: 48, h: 6, type: "spike" as const },
        { x: 3250, y: 442, w: 48, h: 6, type: "spike" as const },
        { x: 4100, y: 442, w: 48, h: 6, type: "spike" as const },
        // Moving platforms
        { x: 700, y: 390, w: 80, h: 16, type: "moving" as const, moveDx: 1.5, moveRange: 100, moveOriginX: 700 },
        { x: 1700, y: 390, w: 80, h: 16, type: "moving" as const, moveDx: -1.5, moveRange: 100, moveOriginX: 1700 },
        { x: 2700, y: 390, w: 80, h: 16, type: "moving" as const, moveDx: 1.5, moveRange: 100, moveOriginX: 2700 },
        { x: 3700, y: 390, w: 80, h: 16, type: "moving" as const, moveDx: -1.5, moveRange: 100, moveOriginX: 3700 },
        // Boss area
        { x: 5200, y: 320, w: 32, h: 128, type: "solid" as const },
        { x: 5200, y: 320, w: 800, h: 32, type: "solid" as const },
      ],
      enemies: [
        ...createSoldiers(350, 416, 5, 500),
        ...createSoldiers(900, 416, 5, 500),
        ...createSoldiers(1400, 416, 5, 500),
        ...createSoldiers(1900, 416, 5, 500),
        ...createSoldiers(2400, 416, 5, 500),
        ...createSoldiers(2900, 416, 5, 500),
        ...createSoldiers(3400, 416, 5, 500),
        ...createSoldiers(3900, 416, 5, 500),
        ...createSoldiers(4400, 416, 5, 500),
        createSniper(440, 348),
        createSniper(880, 348),
        createSniper(1320, 348),
        createSniper(1760, 348),
        createSniper(2200, 348),
        createSniper(2640, 348),
        createSniper(3080, 348),
        createSniper(3520, 348),
        createSniper(3960, 348),
        createTurret(600, 416),
        createTurret(1200, 416),
        createTurret(2000, 416),
        createTurret(2600, 416),
        createTurret(3400, 416),
        createTurret(4000, 416),
        createTurret(4600, 416),
        createShieldSoldier(900, 416),
        createShieldSoldier(1500, 416),
        createShieldSoldier(2100, 416),
        createShieldSoldier(3000, 416),
        createShieldSoldier(3500, 416),
        createShieldSoldier(4200, 416),
        createJumper(1000, 416),
        createJumper(1800, 416),
        createJumper(2500, 416),
        createJumper(3200, 416),
        createJumper(4100, 416),
        createBoss(5600, 340, "snow_boss"),
      ],
      powerUps: [
        createPowerUp(440, 340, "M"),
        createPowerUp(1090, 340, "S"),
        createPowerUp(1530, 330, "R"),
        createPowerUp(2410, 330, "L"),
        createPowerUp(3290, 330, "F"),
        createPowerUp(4170, 330, "S"),
      ],
      bossAt: 5200,
    },
    // ── LEVEL 5: ALIEN HIVE ──
    {
      name: "STAGE 5 - ALIEN HIVE",
      width: 6400,
      bgColor: "#1a0520",
      bgType: "alien",
      platforms: [
        ...Array.from({ length: 200 }, (_, i) => ({
          x: i * TILE, y: 448, w: TILE, h: TILE, type: "solid" as const, color: "#3a1540"
        })),
        { x: 150, y: 390, w: 160, h: 16, type: "solid" as const },
        { x: 380, y: 380, w: 140, h: 16, type: "bridge" as const },
        { x: 590, y: 370, w: 160, h: 16, type: "solid" as const },
        { x: 820, y: 380, w: 140, h: 16, type: "solid" as const },
        { x: 1030, y: 390, w: 160, h: 16, type: "solid" as const },
        { x: 1260, y: 380, w: 140, h: 16, type: "bridge" as const },
        { x: 1470, y: 370, w: 160, h: 16, type: "solid" as const },
        { x: 1700, y: 380, w: 140, h: 16, type: "solid" as const },
        { x: 1910, y: 390, w: 160, h: 16, type: "solid" as const },
        { x: 2140, y: 380, w: 140, h: 16, type: "bridge" as const },
        { x: 2350, y: 370, w: 160, h: 16, type: "solid" as const },
        { x: 2590, y: 380, w: 140, h: 16, type: "solid" as const },
        { x: 2800, y: 390, w: 160, h: 16, type: "solid" as const },
        { x: 3030, y: 380, w: 140, h: 16, type: "solid" as const },
        { x: 3240, y: 370, w: 160, h: 16, type: "bridge" as const },
        { x: 3470, y: 380, w: 140, h: 16, type: "solid" as const },
        { x: 3680, y: 390, w: 160, h: 16, type: "solid" as const },
        { x: 3910, y: 380, w: 140, h: 16, type: "solid" as const },
        { x: 4120, y: 370, w: 160, h: 16, type: "bridge" as const },
        { x: 4350, y: 380, w: 140, h: 16, type: "solid" as const },
        // Spike traps — narrow
        { x: 500, y: 442, w: 48, h: 6, type: "spike" as const },
        { x: 1100, y: 442, w: 48, h: 6, type: "spike" as const },
        { x: 1700, y: 442, w: 64, h: 6, type: "spike" as const },
        { x: 2300, y: 442, w: 48, h: 6, type: "spike" as const },
        { x: 2900, y: 442, w: 48, h: 6, type: "spike" as const },
        { x: 3500, y: 442, w: 64, h: 6, type: "spike" as const },
        { x: 4000, y: 442, w: 48, h: 6, type: "spike" as const },
        // Moving platforms
        { x: 800, y: 390, w: 80, h: 16, type: "moving" as const, moveDx: 1.5, moveRange: 120, moveOriginX: 800 },
        { x: 1800, y: 390, w: 80, h: 16, type: "moving" as const, moveDx: -1.5, moveRange: 120, moveOriginX: 1800 },
        { x: 2800, y: 390, w: 80, h: 16, type: "moving" as const, moveDx: 1.5, moveRange: 120, moveOriginX: 2800 },
        { x: 3800, y: 390, w: 80, h: 16, type: "moving" as const, moveDx: -1.5, moveRange: 120, moveOriginX: 3800 },
        // Boss area
        { x: 5600, y: 320, w: 32, h: 128, type: "solid" as const },
        { x: 5600, y: 320, w: 800, h: 32, type: "solid" as const },
      ],
      enemies: [
        ...createSoldiers(300, 416, 5, 500),
        ...createSoldiers(900, 416, 6, 600),
        ...createSoldiers(1500, 416, 5, 500),
        ...createSoldiers(2100, 416, 6, 600),
        ...createSoldiers(2700, 416, 6, 600),
        ...createSoldiers(3300, 416, 6, 600),
        ...createSoldiers(3900, 416, 5, 500),
        ...createSoldiers(4500, 416, 6, 600),
        createSniper(390, 348),
        createSniper(830, 348),
        createSniper(1270, 348),
        createSniper(1710, 348),
        createSniper(2150, 348),
        createSniper(2600, 348),
        createSniper(3040, 348),
        createSniper(3480, 348),
        createSniper(3920, 348),
        createTurret(700, 416),
        createTurret(1300, 416),
        createTurret(1900, 416),
        createTurret(2500, 416),
        createTurret(3100, 416),
        createTurret(3700, 416),
        createTurret(4300, 416),
        createTurret(4900, 416),
        createShieldSoldier(800, 416),
        createShieldSoldier(1600, 416),
        createShieldSoldier(2400, 416),
        createShieldSoldier(3200, 416),
        createShieldSoldier(4000, 416),
        createShieldSoldier(4800, 416),
        createJumper(600, 416),
        createJumper(1200, 416),
        createJumper(1800, 416),
        createJumper(2600, 416),
        createJumper(3400, 416),
        createJumper(4200, 416),
        createBoss(6000, 340, "alien_boss"),
      ],
      powerUps: [
        createPowerUp(600, 330, "S"),
        createPowerUp(1270, 340, "R"),
        createPowerUp(1710, 330, "M"),
        createPowerUp(2600, 330, "L"),
        createPowerUp(3480, 330, "F"),
        createPowerUp(4350, 340, "S"),
        createPowerUp(4900, 380, "B"),
      ],
      bossAt: 5600,
    },
  ];
}

// ── Enemy Factory Functions ──
function createSoldiers(baseX: number, baseY: number, count: number, spread: number): Enemy[] {
  return Array.from({ length: count }, (_, i) => ({
    x: baseX + (i * spread / count), y: baseY,
    w: 24, h: 32, type: "soldier", hp: 1, maxHp: 1,
    vx: 0, vy: 0, dir: -1, state: "patrol", timer: 0,
    shootTimer: Math.random() * 120 + 60, animFrame: 0, grounded: true,
    patrol: { left: baseX + (i * spread / count) - 80, right: baseX + (i * spread / count) + 80 },
  }));
}
function createSniper(x: number, y: number): Enemy {
  return { x, y, w: 24, h: 32, type: "sniper", hp: 2, maxHp: 2, vx: 0, vy: 0, dir: -1, state: "idle", timer: 0, shootTimer: 80, animFrame: 0, grounded: true };
}
function createTurret(x: number, y: number): Enemy {
  return { x, y: y - 24, w: 32, h: 24, type: "turret", hp: 5, maxHp: 5, vx: 0, vy: 0, dir: -1, state: "idle", timer: 0, shootTimer: 40, animFrame: 0, grounded: true };
}
function createShieldSoldier(x: number, y: number): Enemy {
  return { x, y, w: 28, h: 32, type: "shield", hp: 4, maxHp: 4, vx: 0, vy: 0, dir: -1, state: "patrol", timer: 0, shootTimer: 90, animFrame: 0, grounded: true, patrol: { left: x - 60, right: x + 60 } };
}
function createJumper(x: number, y: number): Enemy {
  return { x, y, w: 24, h: 28, type: "jumper", hp: 2, maxHp: 2, vx: 0, vy: 0, dir: -1, state: "patrol", timer: 0, shootTimer: 100, animFrame: 0, grounded: true, patrol: { left: x - 100, right: x + 100 } };
}
function createBoss(x: number, y: number, bossType: string): Enemy {
  const bossHp: Record<string, number> = { jungle_boss: 40, base_boss: 55, waterfall_boss: 65, snow_boss: 80, alien_boss: 120 };
  return {
    x, y, w: 80, h: 80, type: "boss", hp: bossHp[bossType] || 50, maxHp: bossHp[bossType] || 50,
    vx: 0, vy: 0, dir: -1, state: "idle", timer: 0, shootTimer: 30, animFrame: 0, grounded: true,
    data: { bossType: ["jungle_boss", "base_boss", "waterfall_boss", "snow_boss", "alien_boss"].indexOf(bossType), phase: 0 }
  };
}
function createPowerUp(x: number, y: number, type: PowerUp["type"]): PowerUp {
  return { x, y, w: 24, h: 24, type, vy: 0, life: 1 };
}

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════
export default function ContraGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // UI-only banner state — the game itself only ever has keyboard input, so
  // touch/coarse-pointer visitors are told up front rather than silently
  // dropped into a canvas they can't control.
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    setIsTouchDevice(window.matchMedia("(pointer: coarse)").matches);
  }, []);
  // Game state lives entirely in gameRef (mutated + read by the imperative canvas loop below).
  // Rendering is 100% canvas draw calls — nothing in the JSX below reads game state — so there is
  // no reason to mirror it into React state, which would otherwise re-render this component on
  // every single transition (level start, pause, death, victory...) for zero visual benefit.
  const lastTimeRef = useRef<number | null>(null);
  const accumulatorRef = useRef(0);
  const gameRef = useRef<{
    player: Player; bullets: Bullet[]; particles: Particle[];
    enemies: Enemy[]; platforms: Platform[]; powerUps: PowerUp[];
    camera: Vec2; level: LevelData; levels: LevelData[];
    keys: Record<string, boolean>; gameState: string; currentLevel: number;
    levelTimer: number; shakeTimer: number; shakeIntensity: number;
    bossActive: boolean; bossDefeated: boolean; frameCount: number;
  } | null>(null);

  const initGame = useCallback((levelIdx: number, keepStats?: { lives: number; score: number }) => {
    const levels = createLevels();
    const lvl = levels[levelIdx];
    const player: Player = {
      x: 50, y: 400, w: 20, h: 32,
      vx: 0, vy: 0, dir: 1, aimDir: { x: 1, y: 0 },
      grounded: false, jumping: false, shooting: false, prone: false,
      weapon: "default", weaponTimer: 0,
      hp: 3, maxHp: 3,
      lives: keepStats?.lives ?? 3,
      score: keepStats?.score ?? 0,
      invincible: 120, animFrame: 0, animTimer: 0,
      swimming: false, dead: false, respawnTimer: 0,
    };
    gameRef.current = {
      player, bullets: [], particles: [],
      enemies: lvl.enemies.map(e => ({ ...e })),
      platforms: lvl.platforms.map(p => ({ ...p })),
      powerUps: lvl.powerUps.map(p => ({ ...p })),
      camera: { x: 0, y: 0 }, level: lvl, levels, keys: {},
      gameState: "levelIntro", currentLevel: levelIdx,
      levelTimer: 120, shakeTimer: 0, shakeIntensity: 0,
      bossActive: false, bossDefeated: false, frameCount: 0,
    };
  }, []);

  // ── Input ──
  useEffect(() => {
    const handleKey = (e: KeyboardEvent, down: boolean) => {
      const key = e.key.toLowerCase();
      // Only swallow the keys the game actually uses, and never while a modifier is held —
      // this keeps browser/OS shortcuts (Ctrl+R, Ctrl+Tab, etc.) working while the game is mounted.
      if (GAME_KEYS.has(key) && !e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();

      if (down && key === "enter") {
        if (!gameRef.current || gameRef.current.gameState === "menu" || gameRef.current.gameState === "gameover" || gameRef.current.gameState === "victory") {
          initGame(0); return;
        } else if (gameRef.current.gameState === "levelIntro") {
          gameRef.current.gameState = "playing"; return;
        }
      }
      if (!gameRef.current) return;
      gameRef.current.keys[key] = down;
      if (down && key === "escape") {
        if (gameRef.current.gameState === "playing") gameRef.current.gameState = "paused";
        else if (gameRef.current.gameState === "paused") gameRef.current.gameState = "playing";
      }
    };
    const onKD = (e: KeyboardEvent) => handleKey(e, true);
    const onKU = (e: KeyboardEvent) => handleKey(e, false);
    window.addEventListener("keydown", onKD);
    window.addEventListener("keyup", onKU);
    return () => { window.removeEventListener("keydown", onKD); window.removeEventListener("keyup", onKU); };
  }, [initGame]);

  // ── Game Loop ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;
    let running = true;

    // One fixed-size simulation tick — assumes a 60fps step, exactly like the original code did.
    const stepOnce = () => {
      const g = gameRef.current;
      if (!g) return;
      g.frameCount++;
      if (g.gameState === "levelIntro") {
        g.levelTimer--;
        if (g.levelTimer <= 0) g.gameState = "playing";
      } else if (g.gameState === "playing") {
        update(g);
      }
    };

    const gameLoop = (time: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = time;
      const rawDelta = Math.min(time - lastTimeRef.current, MAX_FRAME_DELTA);
      lastTimeRef.current = time;
      accumulatorRef.current += rawDelta;

      // Run as many fixed 60Hz steps as needed to catch up — keeps physics speed identical
      // regardless of the display's actual refresh rate (60/120/144Hz) or momentary lag.
      while (accumulatorRef.current >= FIXED_DT) {
        stepOnce();
        accumulatorRef.current -= FIXED_DT;
      }

      const g = gameRef.current;
      if (!g) drawMenu(ctx);
      else if (g.gameState === "levelIntro") drawLevelIntro(ctx, g);
      else if (g.gameState === "playing") draw(ctx, g);
      else if (g.gameState === "paused") { draw(ctx, g); drawPauseOverlay(ctx); }
      else if (g.gameState === "gameover") { draw(ctx, g); drawGameOver(ctx, g); }
      else if (g.gameState === "victory") { draw(ctx, g); drawVictory(ctx, g); }
      else drawMenu(ctx);

      if (running) animId = requestAnimationFrame(gameLoop);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(animId);
      } else if (!running) {
        running = true;
        // Drop the stale timestamp/accumulator so the next frame doesn't see a huge
        // "elapsed time" (which would otherwise fast-forward the simulation on return).
        lastTimeRef.current = null;
        accumulatorRef.current = 0;
        animId = requestAnimationFrame(gameLoop);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    animId = requestAnimationFrame(gameLoop);
    return () => {
      running = false;
      cancelAnimationFrame(animId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══════════════════════════════════════════════════
  // UPDATE
  // ═══════════════════════════════════════════════════
  function update(g: NonNullable<typeof gameRef.current>) {
    const p = g.player; const keys = g.keys;
    if (p.dead) {
      p.respawnTimer--;
      if (p.respawnTimer <= 0) {
        if (p.lives > 0) {
          p.lives--; p.dead = false; p.hp = p.maxHp;
          p.x = Math.max(50, g.camera.x + 50); p.y = 300;
          p.vx = 0; p.vy = 0; p.invincible = 120; p.weapon = "default";
        } else { g.gameState = "gameover"; return; }
      }
      updateParticles(g); return;
    }

    let moveX = 0;
    if (keys["arrowleft"] || keys["a"]) moveX = -1;
    if (keys["arrowright"] || keys["d"]) moveX = 1;
    p.prone = (keys["arrowdown"] || keys["s"]) && p.grounded;
    if (!p.prone) { p.vx = moveX * PLAYER_SPEED; if (moveX !== 0) p.dir = moveX; } else { p.vx = 0; }

    const aimX = moveX || p.dir;
    let aimY = 0;
    if (keys["arrowup"] || keys["w"]) aimY = -1;
    if (keys["arrowdown"] || keys["s"]) aimY = p.grounded ? 0 : 1;
    p.aimDir = { x: aimY !== 0 && moveX === 0 ? 0 : aimX, y: aimY };

    if ((keys[" "] || keys["arrowup"] || keys["w"]) && p.grounded && !p.prone) {
      p.vy = JUMP_FORCE; p.grounded = false; p.jumping = true;
    }
    if ((keys["arrowdown"] || keys["s"]) && p.grounded && keys[" "]) { p.y += 4; p.grounded = false; }

    p.vy += GRAVITY; if (p.vy > 12) p.vy = 12;
    p.x += p.vx;
    if (p.x < 0) p.x = 0;
    if (p.x + p.w > g.level.width) p.x = g.level.width - p.w;

    for (const plat of g.platforms) {
      if (plat.type === "bridge" || plat.type === "spike") continue;
      if (plat.type === "destructible" && plat.hp !== undefined && plat.hp <= 0) continue;
      if (rectOverlap(p, plat)) { if (p.vx > 0) p.x = plat.x - p.w; else if (p.vx < 0) p.x = plat.x + plat.w; }
    }

    p.y += p.vy; p.grounded = false;
    for (const plat of g.platforms) {
      if (plat.type === "destructible" && plat.hp !== undefined && plat.hp <= 0) continue;
      if (plat.type === "spike") { if (rectOverlap(p, plat)) damagePlayer(g, 1); continue; }
      if (plat.type === "bridge") {
        if (p.vy > 0 && p.y + p.h <= plat.y + p.vy + 4 && p.x + p.w > plat.x && p.x < plat.x + plat.w) {
          p.y = plat.y - p.h; p.vy = 0; p.grounded = true; p.jumping = false;
        }
        continue;
      }
      if (rectOverlap(p, plat)) {
        if (p.vy > 0) { p.y = plat.y - p.h; p.vy = 0; p.grounded = true; p.jumping = false; }
        else if (p.vy < 0) { p.y = plat.y + plat.h; p.vy = 0; }
      }
    }
    if (p.y > 500) damagePlayer(g, 999);
    if (p.invincible > 0) p.invincible--;
    if (p.weaponTimer > 0) p.weaponTimer--;

    p.shooting = !!(keys["j"] || keys["z"] || keys["x"]);
    if (p.shooting && p.weaponTimer <= 0) shoot(g, p);

    p.animTimer++; if (p.animTimer >= 8) { p.animTimer = 0; p.animFrame = (p.animFrame + 1) % 4; }

    const targetCamX = p.x - CANVAS_W / 3;
    g.camera.x += (targetCamX - g.camera.x) * 0.08;
    if (g.camera.x < 0) g.camera.x = 0;
    if (g.camera.x > g.level.width - CANVAS_W) g.camera.x = g.level.width - CANVAS_W;

    if (g.level.bossAt && p.x >= g.level.bossAt && !g.bossActive) { g.bossActive = true; g.camera.x = g.level.bossAt; }
    if (g.bossActive && g.level.bossAt) g.camera.x = g.level.bossAt;

    for (const plat of g.platforms) {
      if (plat.type === "moving" && plat.moveDx && plat.moveRange && plat.moveOriginX !== undefined) {
        plat.x += plat.moveDx;
        if (plat.x > plat.moveOriginX + plat.moveRange || plat.x < plat.moveOriginX - plat.moveRange) plat.moveDx *= -1;
      }
    }

    updateEnemies(g); updateBullets(g); updateParticles(g);

    for (let i = g.powerUps.length - 1; i >= 0; i--) {
      const pu = g.powerUps[i]; if (pu.life <= 0) continue;
      if (rectOverlap(p, pu)) {
        pu.life = 0;
        if (pu.type === "B") p.invincible = 300; else p.weapon = pu.type;
        p.score += 500;
        spawnParticles(g, pu.x, pu.y, 12, POWERUP_COLORS[pu.type]?.bg || "#FFD700", "spark");
      }
    }

    if (g.bossActive && g.bossDefeated) {
      g.bossDefeated = false; g.bossActive = false;
      const nextLevel = g.currentLevel + 1;
      if (nextLevel < g.levels.length) initGame(nextLevel, { lives: p.lives, score: p.score });
      else { g.gameState = "victory"; }
    }
    if (g.shakeTimer > 0) g.shakeTimer--;
  }

  function shoot(g: NonNullable<typeof gameRef.current>, p: Player) {
    const w = WEAPON_DATA[p.weapon] || WEAPON_DATA["default"];
    p.weaponTimer = w.rate;
    for (let i = 0; i < w.count; i++) {
      let angle = Math.atan2(p.aimDir.y, p.aimDir.x || p.dir);
      if (w.count > 1) { const sr = (w.spread * Math.PI) / 180; angle += (i / (w.count - 1) - 0.5) * sr; }
      g.bullets.push({
        x: p.x + p.w / 2 + Math.cos(angle) * 10,
        y: p.y + (p.prone ? p.h * 0.7 : p.h * 0.3) + Math.sin(angle) * 5,
        vx: Math.cos(angle) * w.speed, vy: Math.sin(angle) * w.speed,
        owner: "player", damage: w.damage, life: 80, type: p.weapon,
      });
    }
    // Muzzle flash
    spawnParticles(g, p.x + p.w / 2 + p.dir * 12, p.y + p.h * 0.3, 3, w.color, "spark");
  }

  function updateBullets(g: NonNullable<typeof gameRef.current>) {
    for (let i = g.bullets.length - 1; i >= 0; i--) {
      const b = g.bullets[i]; b.x += b.vx; b.y += b.vy; b.life--;
      if (b.life <= 0 || b.x < g.camera.x - 50 || b.x > g.camera.x + CANVAS_W + 50 || b.y < -50 || b.y > 500) { g.bullets.splice(i, 1); continue; }
      let hit = false;
      for (const plat of g.platforms) {
        if (plat.type === "bridge" || plat.type === "spike") continue;
        if (plat.type === "destructible" && plat.hp !== undefined && plat.hp <= 0) continue;
        if (b.x >= plat.x && b.x <= plat.x + plat.w && b.y >= plat.y && b.y <= plat.y + plat.h) {
          if (plat.type === "destructible" && plat.hp !== undefined && b.owner === "player") {
            plat.hp -= b.damage;
            if (plat.hp <= 0) { spawnParticles(g, plat.x + plat.w / 2, plat.y + plat.h / 2, 15, "#AA8866"); g.player.score += 200; }
          }
          hit = true; break;
        }
      }
      if (hit) { spawnParticles(g, b.x, b.y, 4, "#FFA500", "spark"); g.bullets.splice(i, 1); continue; }
      if (b.owner === "player") {
        for (let j = g.enemies.length - 1; j >= 0; j--) {
          const e = g.enemies[j]; if (e.hp <= 0) continue;
          if (e.type === "shield" && e.state === "block" && ((b.vx > 0 && b.x < e.x + e.w / 2) || (b.vx < 0 && b.x > e.x + e.w / 2))) {
            spawnParticles(g, b.x, b.y, 4, "#8888FF", "spark"); g.bullets.splice(i, 1); hit = true; break;
          }
          if (b.x >= e.x && b.x <= e.x + e.w && b.y >= e.y && b.y <= e.y + e.h) {
            e.hp -= b.damage; spawnParticles(g, b.x, b.y, 6, "#FF4444");
            if (e.hp <= 0) killEnemy(g, e);
            g.bullets.splice(i, 1); hit = true; break;
          }
        }
        if (hit) continue;
      }
      if (b.owner === "enemy" && g.player.invincible <= 0 && !g.player.dead) {
        const p = g.player;
        if (b.x >= p.x && b.x <= p.x + p.w && b.y >= p.y && b.y <= p.y + p.h) {
          damagePlayer(g, b.damage); g.bullets.splice(i, 1);
        }
      }
    }
  }

  function damagePlayer(g: NonNullable<typeof gameRef.current>, dmg: number) {
    const p = g.player;
    if (p.invincible > 0 || p.dead) return;
    p.hp -= dmg; p.invincible = 60; g.shakeTimer = 10; g.shakeIntensity = 4;
    if (p.hp <= 0) {
      p.dead = true; p.respawnTimer = 90; p.weapon = "default";
      spawnParticles(g, p.x + p.w / 2, p.y + p.h / 2, 35, "#FF0000");
      spawnParticles(g, p.x + p.w / 2, p.y + p.h / 2, 15, "#FFAA00", "spark");
    }
  }

  function killEnemy(g: NonNullable<typeof gameRef.current>, e: Enemy) {
    spawnParticles(g, e.x + e.w / 2, e.y + e.h / 2, e.type === "boss" ? 40 : 20, e.type === "boss" ? "#FF8800" : "#FF4444");
    spawnParticles(g, e.x + e.w / 2, e.y + e.h / 2, e.type === "boss" ? 20 : 8, "#FFDD44", "spark");
    g.shakeTimer = e.type === "boss" ? 30 : 6; g.shakeIntensity = e.type === "boss" ? 8 : 3;
    const scoreMap: Record<string, number> = { soldier: 100, sniper: 200, turret: 300, shield: 250, jumper: 150, boss: 5000 };
    g.player.score += scoreMap[e.type] || 100;
    if (e.type === "boss") {
      g.bossDefeated = true;
      for (let k = 0; k < 8; k++) {
        setTimeout(() => {
          if (gameRef.current) {
            spawnParticles(gameRef.current, e.x + Math.random() * e.w, e.y + Math.random() * e.h, 15, "#FFAA00", "spark");
            spawnParticles(gameRef.current, e.x + Math.random() * e.w, e.y + Math.random() * e.h, 10, "#FF4400");
          }
        }, k * 150);
      }
    }
  }

  function updateEnemies(g: NonNullable<typeof gameRef.current>) {
    const p = g.player;
    for (const e of g.enemies) {
      if (e.hp <= 0) continue;
      const distX = p.x - e.x; const distY = p.y - e.y;
      const dist = Math.sqrt(distX * distX + distY * distY);
      const inRange = dist < 500;
      const onScreen = e.x > g.camera.x - 50 && e.x < g.camera.x + CANVAS_W + 50;
      if (!onScreen && e.type !== "boss") continue;
      e.dir = distX > 0 ? 1 : -1; e.animFrame = (g.frameCount >> 3) % 4;

      switch (e.type) {
        case "soldier": {
          if (e.patrol && e.state === "patrol") { e.vx = e.dir * 0.8; if (inRange) e.state = "chase"; }
          if (e.state === "chase") { e.vx = e.dir * 1.5; if (!inRange) e.state = "patrol"; }
          e.x += e.vx; e.vy += GRAVITY; e.y += e.vy; e.grounded = false;
          for (const plat of g.platforms) {
            if (plat.type === "bridge" || plat.type === "spike") continue;
            if (plat.type === "destructible" && plat.hp !== undefined && plat.hp <= 0) continue;
            if (rectOverlap(e, plat) && e.vy >= 0) { e.y = plat.y - e.h; e.vy = 0; e.grounded = true; }
          }
          if (inRange && !p.dead) { e.shootTimer--; if (e.shootTimer <= 0) { e.shootTimer = 60 + Math.random() * 60; enemyShoot(g, e); } }
          if (!p.dead && rectOverlap(p, e)) damagePlayer(g, 1);
          break;
        }
        case "sniper": {
          if (inRange && !p.dead) { e.shootTimer--; if (e.shootTimer <= 0) { e.shootTimer = 90 + Math.random() * 40; enemyShootAimed(g, e); } }
          break;
        }
        case "turret": {
          e.timer++;
          if (inRange && !p.dead) { e.shootTimer--; if (e.shootTimer <= 0) { e.shootTimer = 25; enemyShootAimed(g, e); } }
          break;
        }
        case "shield": {
          if (inRange) {
            e.timer++;
            if (e.timer % 180 < 60) { e.state = "block"; e.vx = 0; }
            else { e.state = "chase"; e.vx = e.dir * 1.2; }
            e.shootTimer--; if (e.shootTimer <= 0 && e.state !== "block") { e.shootTimer = 90; enemyShoot(g, e); }
          } else { e.state = "patrol"; e.vx = e.dir * 0.5; }
          e.x += e.vx; e.vy += GRAVITY; e.y += e.vy;
          for (const plat of g.platforms) {
            if (plat.type === "bridge" || plat.type === "spike") continue;
            if (plat.type === "destructible" && plat.hp !== undefined && plat.hp <= 0) continue;
            if (rectOverlap(e, plat) && e.vy >= 0) { e.y = plat.y - e.h; e.vy = 0; }
          }
          if (!p.dead && rectOverlap(p, e)) damagePlayer(g, 1);
          break;
        }
        case "jumper": {
          e.vx = e.dir * 2; e.x += e.vx; e.vy += GRAVITY; e.y += e.vy; e.grounded = false;
          for (const plat of g.platforms) {
            if (plat.type === "bridge" || plat.type === "spike") continue;
            if (plat.type === "destructible" && plat.hp !== undefined && plat.hp <= 0) continue;
            if (rectOverlap(e, plat) && e.vy >= 0) { e.y = plat.y - e.h; e.vy = 0; e.grounded = true; }
          }
          if (e.grounded && inRange) { e.timer++; if (e.timer % 45 === 0) { e.vy = -9; e.grounded = false; } }
          if (inRange && !p.dead) { e.shootTimer--; if (e.shootTimer <= 0) { e.shootTimer = 80; enemyShoot(g, e); } }
          if (!p.dead && rectOverlap(p, e)) damagePlayer(g, 1);
          break;
        }
        case "boss": { updateBoss(g, e); if (!p.dead && rectOverlap(p, e)) damagePlayer(g, 1); break; }
      }
    }
  }

  function updateBoss(g: NonNullable<typeof gameRef.current>, boss: Enemy) {
    const p = g.player;
    const phase = boss.hp < boss.maxHp * 0.5 ? 1 : 0;
    boss.data = boss.data || {}; boss.data.phase = phase; boss.timer++;
    if (boss.timer % 120 < 60) boss.vx = boss.dir * 1.5; else boss.vx = 0;
    boss.x += boss.vx; boss.vy += GRAVITY; boss.y += boss.vy;
    for (const plat of g.platforms) {
      if (plat.type === "bridge" || plat.type === "spike") continue;
      if (plat.type === "destructible" && plat.hp !== undefined && plat.hp <= 0) continue;
      if (rectOverlap(boss, plat) && boss.vy >= 0) { boss.y = plat.y - boss.h; boss.vy = 0; boss.grounded = true; }
    }
    if (boss.grounded && boss.timer % 90 === 0) { boss.vy = -8; boss.grounded = false; }
    const shootRate = phase === 1 ? 15 : 25;
    boss.shootTimer--;
    if (boss.shootTimer <= 0 && !p.dead) {
      boss.shootTimer = shootRate;
      const pattern = boss.timer % 3;
      if (pattern === 0) enemyShootAimed(g, boss);
      else if (pattern === 1) {
        for (let i = -2; i <= 2; i++) {
          const angle = Math.atan2(p.y - boss.y, p.x - boss.x) + i * 0.3;
          g.bullets.push({ x: boss.x + boss.w / 2, y: boss.y + boss.h / 3, vx: Math.cos(angle) * 4, vy: Math.sin(angle) * 4, owner: "enemy", damage: 1, life: 120, type: "enemy" });
        }
      } else { enemyShootAimed(g, boss); if (phase === 1) enemyShootAimed(g, boss); }
    }
  }

  function enemyShoot(g: NonNullable<typeof gameRef.current>, e: Enemy) {
    g.bullets.push({ x: e.x + e.w / 2 + e.dir * 10, y: e.y + e.h / 3, vx: e.dir * 4, vy: 0, owner: "enemy", damage: 1, life: 100, type: "enemy" });
  }
  function enemyShootAimed(g: NonNullable<typeof gameRef.current>, e: Enemy) {
    const p = g.player; const dx = p.x - e.x; const dy = p.y - e.y; const d = Math.sqrt(dx * dx + dy * dy) || 1;
    g.bullets.push({ x: e.x + e.w / 2, y: e.y + e.h / 3, vx: (dx / d) * 4.5, vy: (dy / d) * 4.5, owner: "enemy", damage: 1, life: 100, type: "enemy" });
  }

  function spawnParticles(g: NonNullable<typeof gameRef.current>, x: number, y: number, count: number, color: string, shape?: "circle" | "square" | "spark") {
    for (let i = 0; i < count; i++) {
      g.particles.push({
        x, y, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 7 - 2,
        life: 20 + Math.random() * 25, maxLife: 45, color,
        size: shape === "spark" ? 1.5 + Math.random() * 2.5 : 2 + Math.random() * 3.5,
        shape: shape || "square",
        rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.3,
      });
    }
  }

  function updateParticles(g: NonNullable<typeof gameRef.current>) {
    for (let i = g.particles.length - 1; i >= 0; i--) {
      const p = g.particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--;
      if (p.rotation !== undefined && p.rotSpeed !== undefined) p.rotation += p.rotSpeed;
      p.vx *= 0.98; // air drag
      if (p.life <= 0) g.particles.splice(i, 1);
    }
  }

  function rectOverlap(a: Rect, b: Rect): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ═══════════════════════════════════════════════════
  // DRAWING — Upgraded graphics
  // ═══════════════════════════════════════════════════
  function draw(ctx: CanvasRenderingContext2D, g: NonNullable<typeof gameRef.current>) {
    ctx.save();
    let shakeX = 0, shakeY = 0;
    if (g.shakeTimer > 0) { shakeX = (Math.random() - 0.5) * g.shakeIntensity; shakeY = (Math.random() - 0.5) * g.shakeIntensity; }
    ctx.translate(shakeX, shakeY);
    drawBackground(ctx, g);
    ctx.save(); ctx.translate(-g.camera.x, 0);
    drawPlatforms(ctx, g);
    drawPowerUps(ctx, g);
    drawEnemies(ctx, g);
    drawPlayer(ctx, g);
    drawBullets(ctx, g);
    drawParticles(ctx, g);
    ctx.restore();
    drawHUD(ctx, g);
    ctx.restore();
  }

  // ── Background — richly layered parallax ──
  function drawBackground(ctx: CanvasRenderingContext2D, g: NonNullable<typeof gameRef.current>) {
    const lvl = g.level;
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    switch (lvl.bgType) {
      case "jungle": grad.addColorStop(0, "#0d3010"); grad.addColorStop(0.5, "#0a200a"); grad.addColorStop(1, "#050d05"); break;
      case "base": grad.addColorStop(0, "#1a1a2e"); grad.addColorStop(0.5, "#12122a"); grad.addColorStop(1, "#080818"); break;
      case "waterfall": grad.addColorStop(0, "#0e3550"); grad.addColorStop(0.5, "#092535"); grad.addColorStop(1, "#041520"); break;
      case "snow": grad.addColorStop(0, "#3a4a70"); grad.addColorStop(0.5, "#252e50"); grad.addColorStop(1, "#101830"); break;
      case "alien": grad.addColorStop(0, "#3a0855"); grad.addColorStop(0.5, "#250540"); grad.addColorStop(1, "#120220"); break;
    }
    ctx.fillStyle = grad; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Stars layer (very far)
    const p0 = g.camera.x * 0.05;
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    for (let i = 0; i < 80; i++) {
      const sx = ((i * 137 + 50) % CANVAS_W) - (p0 % CANVAS_W);
      const sy = (i * 73 + 20) % (CANVAS_H * 0.7);
      const tw = Math.sin(g.frameCount * 0.02 + i) * 0.5 + 0.5;
      ctx.globalAlpha = 0.2 + tw * 0.5;
      ctx.fillRect(sx < 0 ? sx + CANVAS_W : sx, sy, 1.5 + tw, 1.5 + tw);
    }
    ctx.globalAlpha = 1;

    // Far background layer
    const p1 = g.camera.x * 0.15;
    ctx.globalAlpha = 0.12;
    switch (lvl.bgType) {
      case "jungle": {
        // Far mountains
        ctx.fillStyle = "#1a4a1a";
        for (let i = 0; i < 12; i++) {
          const mx = i * 200 - (p1 % 2400); const bx = mx < -200 ? mx + 2400 : mx;
          const mh = 80 + (i % 3) * 40;
          ctx.beginPath(); ctx.moveTo(bx - 80, 400); ctx.lineTo(bx, 400 - mh); ctx.lineTo(bx + 80, 400); ctx.fill();
        }
        break;
      }
      case "base": {
        for (let i = 0; i < 10; i++) {
          const mx = i * 250 - (p1 % 2500); const bx = mx < -200 ? mx + 2500 : mx;
          ctx.fillStyle = "#222244"; ctx.fillRect(bx, 180, 60, 260);
          ctx.fillStyle = "#1a1a3a"; ctx.fillRect(bx + 15, 150, 30, 30);
        }
        break;
      }
      case "waterfall": {
        ctx.fillStyle = "#3388BB";
        for (let i = 0; i < 6; i++) {
          const wx = i * 350 - (p1 % 2100); const bx = wx < -30 ? wx + 2100 : wx;
          const wOff = Math.sin(g.frameCount * 0.03 + i) * 3;
          ctx.fillRect(bx + wOff, 0, 15, CANVAS_H);
          ctx.fillRect(bx + 6 + wOff, 0, 4, CANVAS_H);
        }
        break;
      }
      case "snow": {
        ctx.fillStyle = "#6070A0";
        for (let i = 0; i < 8; i++) {
          const mx = i * 280 - (p1 % 2240); const bx = mx < -200 ? mx + 2240 : mx;
          const mh = 100 + (i % 3) * 50;
          ctx.beginPath(); ctx.moveTo(bx - 100, 420); ctx.lineTo(bx, 420 - mh); ctx.lineTo(bx + 100, 420); ctx.fill();
        }
        break;
      }
      case "alien": {
        ctx.fillStyle = "#6a1090";
        for (let i = 0; i < 10; i++) {
          const mx = i * 220 - (p1 % 2200); const bx = mx < -60 ? mx + 2200 : mx;
          ctx.beginPath(); ctx.arc(bx, 380, 30 + (i % 3) * 15, 0, Math.PI * 2); ctx.fill();
          ctx.fillRect(bx - 3, 320, 6, 60);
        }
        break;
      }
    }
    ctx.globalAlpha = 1;

    // Mid background layer
    const p2 = g.camera.x * 0.3;
    ctx.globalAlpha = 0.18;
    switch (lvl.bgType) {
      case "jungle": {
        for (let i = 0; i < 20; i++) {
          const tx = i * 160 - (p2 % 3200); const bx = tx < -40 ? tx + 3200 : tx;
          const th = 50 + (i % 4) * 20;
          // Trunk
          ctx.fillStyle = "#3a2510"; ctx.fillRect(bx - 4, 400 - th, 8, th + 48);
          // Foliage
          ctx.fillStyle = "#1a5a1a";
          ctx.beginPath(); ctx.arc(bx, 400 - th - 15, 22 + (i % 3) * 8, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(bx - 10, 400 - th - 5, 16, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(bx + 12, 400 - th - 8, 14, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case "base": {
        for (let i = 0; i < 15; i++) {
          const tx = i * 200 - (p2 % 3000); const bx = tx < -80 ? tx + 3000 : tx;
          ctx.fillStyle = "#334"; ctx.fillRect(bx, 200 + (i % 3) * 40, 70, 200);
          // Windows
          ctx.fillStyle = "#556"; 
          for (let wy = 0; wy < 4; wy++) ctx.fillRect(bx + 10, 210 + (i % 3) * 40 + wy * 35, 15, 10);
        }
        break;
      }
      default: break;
    }
    ctx.globalAlpha = 1;

    // Snow particles (foreground-ish)
    if (lvl.bgType === "snow") {
      ctx.fillStyle = "#FFFFFF";
      for (let i = 0; i < 60; i++) {
        const sx = ((i * 97 + g.frameCount * 0.4) % (CANVAS_W + 20)) - 10;
        const sy = ((i * 53 + g.frameCount * 0.6 + i * 17) % (CANVAS_H + 20)) - 10;
        const sz = 1 + (i % 3);
        ctx.globalAlpha = 0.3 + (i % 4) * 0.1;
        ctx.beginPath(); ctx.arc(sx, sy, sz, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // ── Platforms — textured ──
  function drawPlatforms(ctx: CanvasRenderingContext2D, g: NonNullable<typeof gameRef.current>) {
    for (const plat of g.platforms) {
      if (plat.type === "destructible" && plat.hp !== undefined && plat.hp <= 0) continue;
      if (plat.x + plat.w < g.camera.x - 50 || plat.x > g.camera.x + CANVAS_W + 50) continue;

      switch (plat.type) {
        case "solid": {
          const c = plat.color || "#4a4a4a";
          ctx.fillStyle = c; ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
          // Highlight top edge
          ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(plat.x, plat.y, plat.w, 2);
          // Shadow bottom
          ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.fillRect(plat.x, plat.y + plat.h - 2, plat.w, 2);
          // Tile lines for ground tiles
          if (plat.h >= TILE) {
            ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.lineWidth = 1;
            for (let tx = plat.x; tx < plat.x + plat.w; tx += TILE) {
              ctx.beginPath(); ctx.moveTo(tx, plat.y); ctx.lineTo(tx, plat.y + plat.h); ctx.stroke();
            }
          }
          break;
        }
        case "bridge": {
          // Wooden bridge with detail
          ctx.fillStyle = "#8B5E34"; ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
          ctx.fillStyle = "#A06B3A"; ctx.fillRect(plat.x, plat.y, plat.w, 3);
          for (let px = plat.x; px < plat.x + plat.w; px += 18) {
            ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.fillRect(px, plat.y, 1, plat.h);
          }
          // Rope supports
          ctx.strokeStyle = "#886644"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(plat.x, plat.y + plat.h); ctx.lineTo(plat.x + 8, plat.y + plat.h + 8); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(plat.x + plat.w, plat.y + plat.h); ctx.lineTo(plat.x + plat.w - 8, plat.y + plat.h + 8); ctx.stroke();
          break;
        }
        case "destructible": {
          // Crate/barrel look
          const dmgRatio = plat.hp !== undefined ? plat.hp / 5 : 1;
          ctx.fillStyle = dmgRatio > 0.5 ? "#8B7355" : "#6B5335";
          ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
          ctx.strokeStyle = "#5A432A"; ctx.lineWidth = 2; ctx.strokeRect(plat.x + 1, plat.y + 1, plat.w - 2, plat.h - 2);
          // X pattern
          ctx.strokeStyle = "rgba(90,67,42,0.5)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(plat.x + 3, plat.y + 3); ctx.lineTo(plat.x + plat.w - 3, plat.y + plat.h - 3); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(plat.x + plat.w - 3, plat.y + 3); ctx.lineTo(plat.x + 3, plat.y + plat.h - 3); ctx.stroke();
          // HP bar
          if (plat.hp !== undefined) {
            ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(plat.x, plat.y - 8, plat.w, 5);
            ctx.fillStyle = dmgRatio > 0.5 ? "#44CC44" : "#CC4444";
            ctx.fillRect(plat.x + 1, plat.y - 7, (plat.w - 2) * dmgRatio, 3);
          }
          // Crack effects when damaged
          if (dmgRatio < 0.5) {
            ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(plat.x + plat.w * 0.3, plat.y); ctx.lineTo(plat.x + plat.w * 0.5, plat.y + plat.h * 0.6); ctx.stroke();
          }
          break;
        }
        case "moving": {
          // Glowing tech platform
          const pulse = Math.sin(g.frameCount * 0.06) * 0.15 + 0.85;
          ctx.fillStyle = "#3A6688"; ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
          ctx.fillStyle = `rgba(100,180,220,${0.3 * pulse})`; ctx.fillRect(plat.x + 3, plat.y + 3, plat.w - 6, plat.h - 6);
          // Edge glow
          ctx.strokeStyle = `rgba(100,200,255,${0.5 * pulse})`; ctx.lineWidth = 1.5; ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
          // Direction indicator
          const arrowDir = (plat.moveDx || 0) > 0 ? 1 : -1;
          ctx.fillStyle = `rgba(150,220,255,${0.4 * pulse})`;
          const ax = plat.x + plat.w / 2 + arrowDir * 10;
          ctx.beginPath(); ctx.moveTo(ax, plat.y + 4); ctx.lineTo(ax + arrowDir * 6, plat.y + plat.h / 2); ctx.lineTo(ax, plat.y + plat.h - 4); ctx.fill();
          break;
        }
        case "spike": {
          for (let sx = plat.x; sx < plat.x + plat.w; sx += 10) {
            const gradient = ctx.createLinearGradient(sx + 5, plat.y, sx + 5, plat.y + plat.h);
            gradient.addColorStop(0, "#FF2222"); gradient.addColorStop(1, "#881111");
            ctx.fillStyle = gradient;
            ctx.beginPath(); ctx.moveTo(sx, plat.y + plat.h); ctx.lineTo(sx + 5, plat.y - 2); ctx.lineTo(sx + 10, plat.y + plat.h); ctx.fill();
          }
          // Glow
          ctx.fillStyle = "rgba(255,50,50,0.1)"; ctx.fillRect(plat.x - 2, plat.y - 4, plat.w + 4, plat.h + 6);
          break;
        }
      }
    }
  }

  // ── PowerUps — glowing capsules ──
  function drawPowerUps(ctx: CanvasRenderingContext2D, g: NonNullable<typeof gameRef.current>) {
    for (const pu of g.powerUps) {
      if (pu.life <= 0) continue;
      const pc = POWERUP_COLORS[pu.type] || { bg: "#FFD700", fg: "#000", glow: "rgba(255,215,0,0.4)" };
      const bob = Math.sin(g.frameCount * 0.06) * 3;
      const pulse = Math.sin(g.frameCount * 0.1) * 0.3 + 0.7;

      // Glow
      ctx.save();
      ctx.shadowColor = pc.glow; ctx.shadowBlur = 12 * pulse;
      // Capsule body
      const rx = pu.x + pu.w / 2; const ry = pu.y + pu.h / 2 + bob;
      ctx.fillStyle = pc.bg;
      ctx.beginPath(); ctx.roundRect(pu.x - 2, pu.y - 2 + bob, pu.w + 4, pu.h + 4, 6); ctx.fill();
      ctx.restore();
      // Inner highlight
      ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.fillRect(pu.x + 2, pu.y + 2 + bob, pu.w - 4, pu.h / 3);
      // Letter
      ctx.fillStyle = pc.fg; ctx.font = "bold 13px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(pu.type, rx, ry);
      ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    }
  }

  // ── Bullets — trails & glow ──
  function drawBullets(ctx: CanvasRenderingContext2D, g: NonNullable<typeof gameRef.current>) {
    for (const b of g.bullets) {
      const wd = WEAPON_DATA[b.type] || WEAPON_DATA["default"];
      const col = b.owner === "player" ? wd.color : "#FF4444";
      const size = b.type === "L" ? 5 : b.type === "F" ? 4 : 3;

      // Glow
      ctx.save();
      ctx.shadowColor = col; ctx.shadowBlur = 8;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(b.x, b.y, size, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Core (brighter)
      ctx.fillStyle = "#FFFFFF"; ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.arc(b.x, b.y, size * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;

      // Trail
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = col;
      for (let t = 1; t <= 3; t++) {
        const ts = size * (1 - t * 0.25);
        ctx.beginPath(); ctx.arc(b.x - b.vx * t * 0.5, b.y - b.vy * t * 0.5, ts, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Laser special effect
      if (b.type === "L" && b.owner === "player") {
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = 0.15;
        ctx.beginPath(); ctx.moveTo(b.x - b.vx * 3, b.y - b.vy * 3); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  // ── Particles — shapes & rotation ──
  function drawParticles(ctx: CanvasRenderingContext2D, g: NonNullable<typeof gameRef.current>) {
    for (const p of g.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.rotation !== undefined) ctx.rotate(p.rotation);
      if (p.shape === "circle") {
        ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill();
      } else if (p.shape === "spark") {
        // Elongated spark
        ctx.fillRect(-p.size * 1.5, -p.size * 0.3, p.size * 3, p.size * 0.6);
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ── Player — detailed sprite ──
  function drawPlayer(ctx: CanvasRenderingContext2D, g: NonNullable<typeof gameRef.current>) {
    const p = g.player;
    if (p.dead) return;
    if (p.invincible > 0 && g.frameCount % 4 < 2) return;

    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
    ctx.scale(p.dir, 1);
    const hh = p.prone ? p.h * 0.5 : p.h;
    const yOff = p.prone ? p.h * 0.25 : 0;

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath(); ctx.ellipse(0, hh / 2 + 4 + yOff, p.w * 0.6, 3, 0, 0, Math.PI * 2); ctx.fill();

    // Legs
    if (!p.grounded) {
      ctx.fillStyle = "#2255AA"; ctx.fillRect(-5, hh / 2 - 6 + yOff, 5, 10); ctx.fillRect(2, hh / 2 - 2 + yOff, 5, 10);
      // Boots
      ctx.fillStyle = "#1A3A6A"; ctx.fillRect(-6, hh / 2 + 3 + yOff, 6, 3); ctx.fillRect(2, hh / 2 + 7 + yOff, 6, 3);
    } else if (Math.abs(p.vx) > 0.5 && !p.prone) {
      const legAnim = Math.sin(g.frameCount * 0.35) * 6;
      ctx.fillStyle = "#2255AA"; ctx.fillRect(-5, hh / 2 - 4 + yOff, 5, 8 + legAnim); ctx.fillRect(2, hh / 2 - 4 + yOff, 5, 8 - legAnim);
      ctx.fillStyle = "#1A3A6A"; ctx.fillRect(-6, hh / 2 + 3 + legAnim + yOff, 6, 3); ctx.fillRect(2, hh / 2 + 3 - legAnim + yOff, 6, 3);
    } else if (!p.prone) {
      ctx.fillStyle = "#2255AA"; ctx.fillRect(-5, hh / 2 - 4 + yOff, 5, 9); ctx.fillRect(2, hh / 2 - 4 + yOff, 5, 9);
      ctx.fillStyle = "#1A3A6A"; ctx.fillRect(-6, hh / 2 + 4 + yOff, 6, 3); ctx.fillRect(2, hh / 2 + 4 + yOff, 6, 3);
    }

    // Body — torso with shading
    ctx.fillStyle = "#2860B8"; ctx.fillRect(-p.w / 2, -hh / 2 + yOff, p.w, hh * 0.65);
    // Belt
    ctx.fillStyle = "#1A3A6A"; ctx.fillRect(-p.w / 2, -hh / 2 + hh * 0.6 + yOff, p.w, 4);
    // Chest highlight
    ctx.fillStyle = "rgba(100,160,255,0.2)"; ctx.fillRect(-p.w / 2 + 2, -hh / 2 + 2 + yOff, p.w - 4, hh * 0.2);

    // Arms
    ctx.fillStyle = "#FFBB88";
    const gunAngle = Math.atan2(p.aimDir.y, Math.abs(p.aimDir.x) || 1);
    ctx.save(); ctx.translate(3, -hh / 2 + 10 + yOff); ctx.rotate(gunAngle);
    ctx.fillRect(-2, -3, 12, 5); // arm
    // Gun
    const wColor = WEAPON_DATA[p.weapon]?.color || "#888";
    ctx.fillStyle = "#555"; ctx.fillRect(8, -4, 16, 7);
    ctx.fillStyle = "#777"; ctx.fillRect(10, -3, 12, 5);
    ctx.fillStyle = wColor; ctx.globalAlpha = 0.5; ctx.fillRect(20, -2, 4, 3); ctx.globalAlpha = 1;
    ctx.restore();

    // Head
    ctx.fillStyle = "#FFCC99"; ctx.fillRect(-5, -hh / 2 - 8 + yOff, 10, 10);
    // Eyes
    ctx.fillStyle = "#222"; ctx.fillRect(1, -hh / 2 - 5 + yOff, 2, 2); ctx.fillRect(5, -hh / 2 - 5 + yOff, 2, 2);
    // Hair / headband
    ctx.fillStyle = "#CC2222"; ctx.fillRect(-6, -hh / 2 - 6 + yOff, 13, 3);
    // Hair top
    ctx.fillStyle = "#331111"; ctx.fillRect(-5, -hh / 2 - 10 + yOff, 10, 4);
    // Headband tail
    ctx.fillStyle = "#CC2222";
    const bandWave = Math.sin(g.frameCount * 0.15) * 2;
    ctx.fillRect(-8, -hh / 2 - 5 + yOff, 3, 6 + bandWave);

    // Invincible shield effect
    if (p.invincible > 60) {
      ctx.strokeStyle = "rgba(0,200,255,0.4)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, yOff, p.w + 4, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.restore();
  }

  // ── Enemies — detailed sprites ──
  function drawEnemies(ctx: CanvasRenderingContext2D, g: NonNullable<typeof gameRef.current>) {
    for (const e of g.enemies) {
      if (e.hp <= 0) continue;
      if (e.x + e.w < g.camera.x - 50 || e.x > g.camera.x + CANVAS_W + 50) continue;

      ctx.save(); ctx.translate(e.x + e.w / 2, e.y + e.h / 2);

      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath(); ctx.ellipse(0, e.h / 2 + 2, e.w * 0.5, 2, 0, 0, Math.PI * 2); ctx.fill();

      switch (e.type) {
        case "soldier": {
          // Legs
          const sLeg = Math.sin(g.frameCount * 0.2) * 3;
          ctx.fillStyle = "#554422"; ctx.fillRect(-5, e.h / 2 - 6, 4, 8 + sLeg); ctx.fillRect(2, e.h / 2 - 6, 4, 8 - sLeg);
          // Body
          ctx.fillStyle = "#885533"; ctx.fillRect(-e.w / 2, -e.h / 2, e.w, e.h * 0.7);
          ctx.fillStyle = "#774422"; ctx.fillRect(-e.w / 2, -e.h / 2 + e.h * 0.6, e.w, 4);
          // Head
          ctx.fillStyle = "#DDAA88"; ctx.fillRect(-5, -e.h / 2 - 6, 10, 8);
          ctx.fillStyle = "#333"; ctx.fillRect(-2 + e.dir * 2, -e.h / 2 - 3, 2, 2);
          // Helmet
          ctx.fillStyle = "#556655"; ctx.fillRect(-6, -e.h / 2 - 7, 12, 4);
          ctx.fillStyle = "#667766"; ctx.fillRect(-5, -e.h / 2 - 8, 10, 3);
          break;
        }
        case "sniper": {
          ctx.fillStyle = "#446633"; ctx.fillRect(-e.w / 2, -e.h / 2, e.w, e.h * 0.7);
          ctx.fillStyle = "#335522"; ctx.fillRect(-e.w / 2, -e.h / 2 + e.h * 0.6, e.w, 4);
          // Ghillie strips
          ctx.fillStyle = "#3a6633";
          for (let s = 0; s < 3; s++) ctx.fillRect(-e.w / 2 + s * 6 - 2, -e.h / 2 + 2, 4, 10);
          ctx.fillStyle = "#DDAA88"; ctx.fillRect(-5, -e.h / 2 - 6, 10, 8);
          ctx.fillStyle = "#222"; ctx.fillRect(-1 + e.dir * 2, -e.h / 2 - 3, 2, 2);
          // Sniper scope
          ctx.fillStyle = "#666"; ctx.fillRect(e.dir * 6, -e.h / 2 + 2, e.dir * 20, 3);
          ctx.fillStyle = "#88AAFF"; ctx.beginPath(); ctx.arc(e.dir * 26, -e.h / 2 + 3, 2, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case "turret": {
          // Base with metal sheen
          ctx.fillStyle = "#555"; ctx.fillRect(-e.w / 2, 2, e.w, e.h / 2);
          ctx.fillStyle = "#666";
          ctx.beginPath(); ctx.moveTo(-e.w / 2 - 4, e.h / 2); ctx.lineTo(-e.w / 2, 2); ctx.lineTo(e.w / 2, 2); ctx.lineTo(e.w / 2 + 4, e.h / 2); ctx.fill();
          // Rotating barrel
          const angle = Math.atan2(g.player.y - e.y, g.player.x - e.x);
          ctx.save(); ctx.rotate(angle);
          ctx.fillStyle = "#888"; ctx.fillRect(0, -4, 26, 8);
          ctx.fillStyle = "#999"; ctx.fillRect(0, -3, 24, 6);
          ctx.fillStyle = "#FF8844"; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(26, 0, 3, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
          ctx.restore();
          // Cap
          ctx.fillStyle = "#777";
          ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#999";
          ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case "shield": {
          // Legs
          ctx.fillStyle = "#554422"; ctx.fillRect(-5, e.h / 2 - 6, 4, 8); ctx.fillRect(2, e.h / 2 - 6, 4, 8);
          ctx.fillStyle = "#885533"; ctx.fillRect(-e.w / 2, -e.h / 2, e.w, e.h * 0.7);
          // Shield 
          if (e.state === "block") {
            ctx.fillStyle = "#4466AA"; ctx.fillRect(-e.dir * (e.w / 2 + 5), -e.h / 2 - 2, 7, e.h + 4);
            ctx.fillStyle = "#5577CC"; ctx.fillRect(-e.dir * (e.w / 2 + 4), -e.h / 2, 5, e.h);
            // Shield glow
            ctx.fillStyle = "rgba(100,120,200,0.2)"; ctx.fillRect(-e.dir * (e.w / 2 + 8), -e.h / 2 - 4, 12, e.h + 8);
          }
          ctx.fillStyle = "#DDAA88"; ctx.fillRect(-5, -e.h / 2 - 6, 10, 8);
          ctx.fillStyle = "#444"; ctx.fillRect(-6, -e.h / 2 - 7, 12, 4);
          break;
        }
        case "jumper": {
          ctx.fillStyle = "#662255"; ctx.fillRect(-e.w / 2, -e.h / 2, e.w, e.h * 0.7);
          ctx.fillStyle = "#551144"; ctx.fillRect(-e.w / 2, -e.h / 2 + e.h * 0.6, e.w, 4);
          // Spring legs
          const spr = e.grounded ? 0 : -3;
          ctx.fillStyle = "#BBBB33"; ctx.fillRect(-6, e.h / 2 - 6, 5, 8 + spr); ctx.fillRect(3, e.h / 2 - 6, 5, 8 + spr);
          ctx.fillStyle = "#DDDD55";
          for (let sy = 0; sy < 3; sy++) {
            ctx.fillRect(-7, e.h / 2 - 4 + sy * 3, 6, 1);
            ctx.fillRect(3, e.h / 2 - 4 + sy * 3, 6, 1);
          }
          ctx.fillStyle = "#DDAA88"; ctx.fillRect(-5, -e.h / 2 - 6, 10, 8);
          ctx.fillStyle = "#222"; ctx.fillRect(-1 + e.dir * 2, -e.h / 2 - 3, 2, 2);
          break;
        }
        case "boss": {
          const phase = e.data?.phase || 0;
          const bossIdx = e.data?.bossType || 0;
          const bossBaseColors = ["#AA3333", "#3333AA", "#33AAAA", "#7733AA", "#AA33AA"];
          const bossAccentColors = ["#CC5555", "#5555CC", "#55CCCC", "#9955CC", "#CC55CC"];
          const bc = bossBaseColors[bossIdx]; const ba = bossAccentColors[bossIdx];

          // Body glow when phase 2
          if (phase === 1) {
            ctx.fillStyle = "rgba(255,80,80,0.1)";
            ctx.beginPath(); ctx.arc(0, 0, e.w * 0.7, 0, Math.PI * 2); ctx.fill();
          }

          // Body
          ctx.fillStyle = bc; ctx.fillRect(-e.w / 2, -e.h / 2, e.w, e.h);
          // Armor plates
          ctx.fillStyle = ba;
          ctx.fillRect(-e.w / 2 + 4, -e.h / 2 + 4, e.w - 8, 10);
          ctx.fillRect(-e.w / 2 + 4, e.h / 2 - 14, e.w - 8, 10);
          ctx.fillRect(-e.w / 2 + 4, -e.h / 2 + 4, 10, e.h - 8);
          ctx.fillRect(e.w / 2 - 14, -e.h / 2 + 4, 10, e.h - 8);
          // Inner detail
          ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(-e.w / 2 + 16, -e.h / 2 + 16, e.w - 32, e.h - 32);

          // Face
          const eyeFlash = phase === 1 && g.frameCount % 10 < 3;
          ctx.fillStyle = eyeFlash ? "#FFFFFF" : "#FF0000";
          ctx.beginPath(); ctx.arc(-10, -8, 5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(10, -8, 5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#000";
          ctx.beginPath(); ctx.arc(-10, -8, 2, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(10, -8, 2, 0, Math.PI * 2); ctx.fill();
          // Mouth
          ctx.fillStyle = phase === 1 ? "#FF4400" : "#660000";
          ctx.fillRect(-12, 6, 24, 8);
          // Teeth
          ctx.fillStyle = "#FFFFFF";
          for (let t = 0; t < 6; t++) ctx.fillRect(-10 + t * 4, 6, 2, 4);

          // HP Bar — above boss
          ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(-e.w / 2, -e.h / 2 - 14, e.w, 8);
          const hpGrad = ctx.createLinearGradient(-e.w / 2, 0, -e.w / 2 + e.w * (e.hp / e.maxHp), 0);
          if (phase === 1) { hpGrad.addColorStop(0, "#FF0000"); hpGrad.addColorStop(1, "#FF4400"); }
          else { hpGrad.addColorStop(0, "#00CC44"); hpGrad.addColorStop(1, "#44FF88"); }
          ctx.fillStyle = hpGrad; ctx.fillRect(-e.w / 2 + 1, -e.h / 2 - 13, (e.w - 2) * (e.hp / e.maxHp), 6);
          ctx.strokeStyle = "#888"; ctx.lineWidth = 1; ctx.strokeRect(-e.w / 2, -e.h / 2 - 14, e.w, 8);
          break;
        }
      }
      ctx.restore();
    }
  }

  // ── HUD — polished ──
  function drawHUD(ctx: CanvasRenderingContext2D, g: NonNullable<typeof gameRef.current>) {
    const p = g.player;
    // Top bar — gradient
    const hudGrad = ctx.createLinearGradient(0, 0, 0, 44);
    hudGrad.addColorStop(0, "rgba(0,0,0,0.75)"); hudGrad.addColorStop(1, "rgba(0,0,0,0.4)");
    ctx.fillStyle = hudGrad; ctx.fillRect(0, 0, CANVAS_W, 44);
    ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.fillRect(0, 43, CANVAS_W, 1);

    ctx.font = "bold 13px monospace";

    // Lives — heart icons
    ctx.fillStyle = "#FF4444";
    for (let i = 0; i < p.lives; i++) {
      const hx = 14 + i * 18;
      ctx.beginPath();
      ctx.moveTo(hx, 22); ctx.bezierCurveTo(hx, 18, hx - 6, 14, hx - 6, 18);
      ctx.bezierCurveTo(hx - 6, 22, hx, 26, hx, 28);
      ctx.bezierCurveTo(hx, 26, hx + 6, 22, hx + 6, 18);
      ctx.bezierCurveTo(hx + 6, 14, hx, 18, hx, 22); ctx.fill();
    }

    // HP bar — gradient
    const hpX = 72; const hpW = 90;
    ctx.fillStyle = "#222"; ctx.fillRect(hpX, 16, hpW, 12);
    if (p.hp > 0) {
      const hpGrad2 = ctx.createLinearGradient(hpX, 0, hpX + hpW * (p.hp / p.maxHp), 0);
      if (p.hp > 1) { hpGrad2.addColorStop(0, "#00AA33"); hpGrad2.addColorStop(1, "#00DD55"); }
      else { hpGrad2.addColorStop(0, "#CC2222"); hpGrad2.addColorStop(1, "#FF4444"); }
      ctx.fillStyle = hpGrad2; ctx.fillRect(hpX, 16, hpW * (p.hp / p.maxHp), 12);
    }
    ctx.strokeStyle = "#555"; ctx.lineWidth = 1; ctx.strokeRect(hpX, 16, hpW, 12);
    ctx.fillStyle = "#FFF"; ctx.font = "9px monospace"; ctx.fillText("HP", hpX + 2, 25);

    // Weapon
    ctx.font = "bold 13px monospace";
    const wName = p.weapon === "default" ? "NORMAL" : p.weapon;
    const wCol = WEAPON_DATA[p.weapon]?.color || "#FFF";
    ctx.fillStyle = wCol; ctx.fillText(wName, 175, 26);

    // Score — centered with icon
    ctx.fillStyle = "#FFD700"; ctx.textAlign = "center"; ctx.font = "bold 14px monospace";
    ctx.fillText(`★ ${p.score.toLocaleString()}`, CANVAS_W / 2, 26);

    // Level
    ctx.fillStyle = "#CCCCDD"; ctx.textAlign = "right"; ctx.font = "bold 12px monospace";
    ctx.fillText(`STAGE ${g.currentLevel + 1}`, CANVAS_W - 15, 26);
    ctx.textAlign = "left";

    // Boss HP bar (if active)
    if (g.bossActive) {
      const boss = g.enemies.find(e => e.type === "boss" && e.hp > 0);
      if (boss) {
        const bw = 280; const bx = CANVAS_W / 2 - bw / 2;
        ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(bx - 2, 46, bw + 4, 18);
        const bossGrad = ctx.createLinearGradient(bx, 0, bx + bw * (boss.hp / boss.maxHp), 0);
        bossGrad.addColorStop(0, "#CC0000"); bossGrad.addColorStop(1, "#FF4400");
        ctx.fillStyle = bossGrad; ctx.fillRect(bx, 48, bw * (boss.hp / boss.maxHp), 14);
        ctx.strokeStyle = "#888"; ctx.lineWidth = 1; ctx.strokeRect(bx, 48, bw, 14);
        ctx.fillStyle = "#FFF"; ctx.font = "bold 10px monospace"; ctx.textAlign = "center";
        ctx.fillText("★ BOSS ★", CANVAS_W / 2, 59); ctx.textAlign = "left";
      }
    }
  }

  // ── Menu — cinematic ──
  function drawMenu(ctx: CanvasRenderingContext2D) {
    const t = Date.now() * 0.001;
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, "#060618"); grad.addColorStop(0.5, "#0a0a2e"); grad.addColorStop(1, "#000");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Animated star field
    for (let i = 0; i < 100; i++) {
      const x = (i * 137 + t * (10 + i % 5)) % CANVAS_W;
      const y = (i * 73 + t * (5 + i % 3)) % CANVAS_H;
      const tw = Math.sin(t * 2 + i) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(255,255,255,${0.15 + tw * 0.45})`;
      ctx.fillRect(x, y, 1 + tw, 1 + tw);
    }

    // Scanline effect
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    for (let sy = 0; sy < CANVAS_H; sy += 3) ctx.fillRect(0, sy, CANVAS_W, 1);

    // Title glow
    ctx.save();
    ctx.shadowColor = "#FF2200"; ctx.shadowBlur = 30 + Math.sin(t * 2) * 10;
    ctx.textAlign = "center"; ctx.font = "bold 60px monospace"; ctx.fillStyle = "#FF3333";
    ctx.fillText("CONTRA", CANVAS_W / 2, 130);
    ctx.restore();

    // Title outline
    ctx.textAlign = "center"; ctx.font = "bold 60px monospace";
    ctx.strokeStyle = "#FF8866"; ctx.lineWidth = 1; ctx.strokeText("CONTRA", CANVAS_W / 2, 130);

    // Subtitle
    ctx.font = "bold 16px monospace"; ctx.fillStyle = "#FFD700";
    ctx.fillText("⬥ WEB EDITION ⬥", CANVAS_W / 2, 160);

    ctx.font = "12px monospace"; ctx.fillStyle = "#667";
    ctx.fillText("A Web Clone of the Classic Arcade Game", CANVAS_W / 2, 185);

    // Controls box
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(CANVAS_W / 2 - 200, 210, 400, 145);
    ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1;
    ctx.strokeRect(CANVAS_W / 2 - 200, 210, 400, 145);

    ctx.font = "bold 11px monospace"; ctx.fillStyle = "#8888AA";
    ctx.fillText("── CONTROLS ──", CANVAS_W / 2, 230);

    ctx.font = "12px monospace"; ctx.fillStyle = "#9999BB";
    const controls = [
      "←  →  ↑  ↓  /  WASD     Move & Aim",
      "SPACE  /  W  /  ↑        Jump",
      "Z  /  X  /  J            Shoot",
      "↓  +  SPACE              Drop Through",
      "ESC                      Pause",
    ];
    controls.forEach((text, i) => ctx.fillText(text, CANVAS_W / 2, 255 + i * 20));

    // Blinking prompt
    if (Math.sin(t * 3) > 0) {
      ctx.save(); ctx.shadowColor = "#FFF"; ctx.shadowBlur = 10;
      ctx.font = "bold 18px monospace"; ctx.fillStyle = "#FFFFFF";
      ctx.fillText("▶  PRESS ENTER TO START  ◀", CANVAS_W / 2, 420);
      ctx.restore();
    }
    ctx.textAlign = "left";
  }

  function drawLevelIntro(ctx: CanvasRenderingContext2D, g: NonNullable<typeof gameRef.current>) {
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Scanlines
    ctx.fillStyle = "rgba(255,255,255,0.02)";
    for (let sy = 0; sy < CANVAS_H; sy += 3) ctx.fillRect(0, sy, CANVAS_W, 1);

    ctx.textAlign = "center";

    // Stage name with glow
    ctx.save(); ctx.shadowColor = "#FF4444"; ctx.shadowBlur = 20;
    ctx.font = "bold 36px monospace"; ctx.fillStyle = "#FF4444";
    ctx.fillText(g.level.name, CANVAS_W / 2, CANVAS_H / 2 - 30);
    ctx.restore();

    // Lives
    ctx.font = "16px monospace"; ctx.fillStyle = "#AAA";
    ctx.fillText(`Lives: ${g.player.lives}`, CANVAS_W / 2, CANVAS_H / 2 + 15);

    // Score
    ctx.font = "14px monospace"; ctx.fillStyle = "#FFD700";
    ctx.fillText(`Score: ${g.player.score.toLocaleString()}`, CANVAS_W / 2, CANVAS_H / 2 + 40);

    if (Math.sin(Date.now() * 0.005) > 0) {
      ctx.font = "bold 14px monospace"; ctx.fillStyle = "#888";
      ctx.fillText("PRESS ENTER OR WAIT...", CANVAS_W / 2, CANVAS_H / 2 + 80);
    }
    ctx.textAlign = "left";
  }

  function drawPauseOverlay(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    // Scanlines
    ctx.fillStyle = "rgba(255,255,255,0.02)";
    for (let sy = 0; sy < CANVAS_H; sy += 3) ctx.fillRect(0, sy, CANVAS_W, 1);

    ctx.textAlign = "center";
    ctx.save(); ctx.shadowColor = "#FFF"; ctx.shadowBlur = 15;
    ctx.font = "bold 40px monospace"; ctx.fillStyle = "#FFFFFF";
    ctx.fillText("PAUSED", CANVAS_W / 2, CANVAS_H / 2 - 10);
    ctx.restore();
    ctx.font = "14px monospace"; ctx.fillStyle = "#888";
    ctx.fillText("Press ESC to Resume", CANVAS_W / 2, CANVAS_H / 2 + 30);
    ctx.textAlign = "left";
  }

  function drawGameOver(ctx: CanvasRenderingContext2D, g: NonNullable<typeof gameRef.current>) {
    ctx.fillStyle = "rgba(0,0,0,0.85)"; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.textAlign = "center";
    ctx.save(); ctx.shadowColor = "#FF0000"; ctx.shadowBlur = 25;
    ctx.font = "bold 52px monospace"; ctx.fillStyle = "#FF0000";
    ctx.fillText("GAME OVER", CANVAS_W / 2, CANVAS_H / 2 - 30);
    ctx.restore();
    ctx.font = "bold 20px monospace"; ctx.fillStyle = "#FFD700";
    ctx.fillText(`FINAL SCORE: ${g.player.score.toLocaleString()}`, CANVAS_W / 2, CANVAS_H / 2 + 20);
    if (Math.sin(Date.now() * 0.005) > 0) {
      ctx.font = "16px monospace"; ctx.fillStyle = "#FFF";
      ctx.fillText("PRESS ENTER TO RETRY", CANVAS_W / 2, CANVAS_H / 2 + 60);
    }
    ctx.textAlign = "left";
  }

  function drawVictory(ctx: CanvasRenderingContext2D, g: NonNullable<typeof gameRef.current>) {
    ctx.fillStyle = "rgba(0,0,0,0.85)"; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.textAlign = "center";
    ctx.save(); ctx.shadowColor = "#FFD700"; ctx.shadowBlur = 30;
    ctx.font = "bold 44px monospace"; ctx.fillStyle = "#FFD700";
    ctx.fillText("★ VICTORY! ★", CANVAS_W / 2, CANVAS_H / 2 - 60);
    ctx.restore();
    ctx.font = "bold 22px monospace"; ctx.fillStyle = "#FFF";
    ctx.fillText("ALL STAGES CLEARED!", CANVAS_W / 2, CANVAS_H / 2 - 20);
    ctx.font = "bold 20px monospace"; ctx.fillStyle = "#FFD700";
    ctx.fillText(`FINAL SCORE: ${g.player.score.toLocaleString()}`, CANVAS_W / 2, CANVAS_H / 2 + 20);
    ctx.font = "16px monospace"; ctx.fillStyle = "#AAA";
    ctx.fillText(`Lives Remaining: ${g.player.lives}`, CANVAS_W / 2, CANVAS_H / 2 + 50);
    if (Math.sin(Date.now() * 0.005) > 0) {
      ctx.save(); ctx.shadowColor = "#FFF"; ctx.shadowBlur = 8;
      ctx.font = "bold 16px monospace"; ctx.fillStyle = "#FFF";
      ctx.fillText("PRESS ENTER TO PLAY AGAIN", CANVAS_W / 2, CANVAS_H / 2 + 90);
      ctx.restore();
    }
    ctx.textAlign = "left";
  }

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="mb-4 text-center">
        <h1 className="text-3xl font-bold text-red-500 font-mono tracking-[0.3em] drop-shadow-[0_0_10px_rgba(255,50,50,0.5)]">CONTRA</h1>
        <p className="text-gray-600 text-xs font-mono tracking-widest mt-1">WEB EDITION</p>
      </div>

      {isTouchDevice && (
        <div className="mb-4 max-w-md text-center text-xs font-mono text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-md px-4 py-2">
          ⌨️ Trò chơi này chỉ hỗ trợ điều khiển bằng bàn phím — trải nghiệm tốt nhất trên máy tính.
        </div>
      )}

      <div className="relative w-full max-w-[800px] border-2 border-gray-800 rounded-lg overflow-hidden shadow-[0_0_40px_rgba(255,50,50,0.1)]">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="block w-full h-auto bg-black"
          style={{ imageRendering: "pixelated" }}
          tabIndex={0}
        />
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs font-mono text-gray-500 max-w-2xl">
        <span className="px-3 py-1.5 bg-gray-900/50 border border-gray-800 rounded-md">← → ↑ ↓ Move/Aim</span>
        <span className="px-3 py-1.5 bg-gray-900/50 border border-gray-800 rounded-md">SPACE Jump</span>
        <span className="px-3 py-1.5 bg-gray-900/50 border border-gray-800 rounded-md">Z / X / J Shoot</span>
        <span className="px-3 py-1.5 bg-gray-900/50 border border-gray-800 rounded-md">ESC Pause</span>
        <span className="px-3 py-1.5 bg-gray-900/50 border border-gray-800 rounded-md">↓ + SPACE Drop</span>
      </div>

      <div className="mt-3 text-xs font-mono text-gray-600 max-w-lg text-center space-y-1">
        <p className="flex flex-wrap justify-center gap-2">
          <span className="text-red-400 bg-red-400/10 px-2 py-0.5 rounded">S Spread</span>
          <span className="text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded">M Machine</span>
          <span className="text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">L Laser</span>
          <span className="text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded">R Rapid</span>
          <span className="text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded">F Flame</span>
          <span className="text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded">B Barrier</span>
        </p>
      </div>
    </div>
  );
}
