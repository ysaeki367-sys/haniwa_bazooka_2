"use strict";

// ============================================================
// haniwa bazooka 2  -  main.py (pygame) の JavaScript / HTML5 Canvas 移植版
// ============================================================

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.focus();

// ★ あなたの GAS ウェブアプリのデプロイ URL をここに貼り付けてください
const GAS_URL = "https://script.google.com/macros/s/AKfycbwKfEVpK6NlF4yFsuwUJwMXt1vH8cd7NJkNSz4ijxf6MSmbpnX5HCRW2q-iOymhDo7xYA/exec";

const WIDTH = 480;
const HEIGHT = 640;

const WHITE = "rgb(255,255,255)";
const BLACK = "rgb(0,0,0)";
const RED = "rgb(255,0,0)";

// ---- 乱数ヘルパー（Python の random 相当） ----
const randint = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a; // 両端含む
const uniform = (a, b) => Math.random() * (b - a) + a;
const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = () => Math.random();
const radians = (deg) => (deg * Math.PI) / 180;
const hypot = Math.hypot;

// ============================================================
// 画像・音声・フォント読み込み
// ============================================================
function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}
function isDrawable(d) {
  if (!d) return false;
  if (d instanceof HTMLCanvasElement) return true;
  return d.complete && d.naturalWidth > 0;
}

const IMG = {
  bg: loadImage("images/background.png"),
  player: loadImage("images/player.png"),
  enemy1: loadImage("images/enemy1.png"),
  enemy2: loadImage("images/enemy2.png"),
  enemy3: loadImage("images/enemy3.png"),
  enemy4: loadImage("images/enemy4.png"),
  boss: loadImage("images/boss.png"),
  boss2: loadImage("images/boss2.png"),
  boss3: loadImage("images/boss3.png"),
  boss4: loadImage("images/boss4.png"),
  boss5: loadImage("images/boss5.png"),
  boss6: loadImage("images/boss6.png"),
  boss7: loadImage("images/boss7.png"),
  heart: loadImage("images/heart.png"),
  gem_green: loadImage("images/gem_green.png"),
  gem_cyan: loadImage("images/gem_cyan.png"),
  gem_blue: loadImage("images/gem_blue.png"),
  gem_yellow: loadImage("images/gem_yellow.png"),
  gem_purple: loadImage("images/gem_purple.png"),
  gem_orange: loadImage("images/gem_orange.png"),
  slime_purple: loadImage("images/enemy_slime_purple.png"),
  slime_red: loadImage("images/enemy_slime_red.png"),
};

// 効果音（.ogg）。ファイルが無くても無音で動作します。
class Sound {
  constructor(src, volume = 1.0) {
    this.src = src;
    this.volume = volume;
    this.available = true; // 読み込み失敗（ファイル無し等）で false
    this.base = new Audio(src);
    this.base.volume = volume;
    this.base.addEventListener("error", () => { this.available = false; });
  }
  play() {
    try {
      const a = this.base.cloneNode();
      a.volume = this.volume;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {
      /* 無音フォールバック */
    }
  }
}

const se_shoot = new Sound("sounds/shoot.ogg");
const se_hit = new Sound("sounds/hit.ogg");
const se_explosion = new Sound("sounds/explosion.ogg");
const se_damage = new Sound("sounds/damage.ogg");
const se_gameover = new Sound("sounds/gameover.ogg");
const se_clear = new Sound("sounds/clear.ogg");

// SHADOW スキン専用の効果音（無ければ通常音にフォールバック）
const se_shoot_shadow = new Sound("sounds/shoot_shadow.ogg");
const se_damage_shadow = new Sound("sounds/damage_shadow.ogg");
const se_hit_shadow = new Sound("sounds/hit_shadow.ogg");

const SHADOW_SKIN = 7;
function is_shadow_skin() { return selected_skin === SHADOW_SKIN; }
// SHADOW選択時かつ専用音が読み込めている場合のみ差し替え
function play_shoot_se() { ((is_shadow_skin() && se_shoot_shadow.available) ? se_shoot_shadow : se_shoot).play(); }
function play_player_hit_se() { ((is_shadow_skin() && se_damage_shadow.available) ? se_damage_shadow : se_damage).play(); }
function play_shield_break_se() { ((is_shadow_skin() && se_hit_shadow.available) ? se_hit_shadow : se_hit).play(); }

// BGM
const bgm = new Audio("sounds/bgm.ogg");
bgm.loop = true;
bgm.volume = 0.5;

function playBgm() {
  try {
    // 再生中の場合はロードをスキップ（瞬断防止）
    if (!bgm.paused) return;
    const p = bgm.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {
    console.log("BGM play failed:", e);
  }
}
function stopBgm() {
  try {
    bgm.pause();
    bgm.currentTime = 0;
  } catch (e) {}
}

// PixelWarden フォント読み込み（無い場合は monospace にフォールバック）
if (window.FontFace) {
  try {
    const ff = new FontFace("PixelWarden", "url(fonts/PixelWarden.ttf)");
    ff.load().then((f) => document.fonts.add(f)).catch(() => {});
  } catch (e) {}
}

// ============================================================
// Rect（pygame.Rect 相当の当たり判定＆座標ヘルパー）
// ============================================================
class Rect {
  constructor(x = 0, y = 0, w = 0, h = 0) {
    this.x = x;
    this.y = y;
    this.width = w;
    this.height = h;
  }
  get left() { return this.x; }
  set left(v) { this.x = v; }
  get top() { return this.y; }
  set top(v) { this.y = v; }
  get right() { return this.x + this.width; }
  set right(v) { this.x = v - this.width; }
  get bottom() { return this.y + this.height; }
  set bottom(v) { this.y = v - this.height; }
  get centerx() { return this.x + this.width / 2; }
  set centerx(v) { this.x = v - this.width / 2; }
  get centery() { return this.y + this.height / 2; }
  set centery(v) { this.y = v - this.height / 2; }
  get center() { return [this.centerx, this.centery]; }
  set center(v) { this.centerx = v[0]; this.centery = v[1]; }
  colliderect(o) {
    return (
      this.left < o.right &&
      this.right > o.left &&
      this.top < o.bottom &&
      this.bottom > o.top
    );
  }
}

// ============================================================
// スプライトグループ操作
// ============================================================
function addTo(group, sprite) {
  sprite.group = group;
  sprite.alive = true;
  group.push(sprite);
  return sprite;
}
function killSprite(s) {
  s.alive = false;
  const g = s.group;
  if (g) {
    const i = g.indexOf(s);
    if (i >= 0) g.splice(i, 1);
  }
}
function updateGroup(arr) {
  const snapshot = arr.slice();
  for (const s of snapshot) {
    if (s.alive) s.update();
  }
}
// pygame.sprite.spritecollide 相当
function spritecollide(target, groupArr, dokill, collided) {
  const hits = [];
  for (let i = groupArr.length - 1; i >= 0; i--) {
    const s = groupArr[i];
    const c = collided ? collided(target, s) : target.rect.colliderect(s.rect);
    if (c) {
      hits.push(s);
      if (dokill) {
        groupArr.splice(i, 1);
        s.alive = false;
      }
    }
  }
  return hits;
}

// ============================================================
// 描画ヘルパー
// ============================================================
function drawSprite(img, rect, fallbackColor) {
  if (isDrawable(img)) {
    ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height);
  } else {
    ctx.fillStyle = fallbackColor;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  }
}
function drawText(text, x, y, size, color, align = "left") {
  ctx.font = `${size}px 'PixelWarden', monospace`;
  ctx.fillStyle = color;
  ctx.textBaseline = "top";
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.textAlign = "left";
}
function textWidth(text, size) {
  ctx.font = `${size}px 'PixelWarden', monospace`;
  return ctx.measureText(text).width;
}

// player.png をベースにした色調ブレンド（画像が無いスキン用フォールバック）
function makeTinted(baseImg, color, w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const cx = c.getContext("2d");
  cx.drawImage(baseImg, 0, 0, w, h);
  cx.globalCompositeOperation = "multiply";
  cx.fillStyle = color;
  cx.fillRect(0, 0, w, h);
  cx.globalCompositeOperation = "destination-in";
  cx.drawImage(baseImg, 0, 0, w, h);
  return c;
}

// 自機スキン定義（player2〜8 が無い場合の色フォールバック付き）
const playerSkins = [
  { img: IMG.player, color: "rgb(230,230,230)", base: true }, // 0: NORMAL
  { img: loadImage("images/player2.png"), color: "rgb(180,200,220)" }, // 1: SILVER
  { img: loadImage("images/player3.png"), color: "rgb(255,215,0)" }, // 2: GOLD
  { img: loadImage("images/player4.png"), color: "rgb(0,255,255)" }, // 3: CYBER
  { img: loadImage("images/player5.png"), color: "rgb(255,50,50)" }, // 4: RUBY
  { img: loadImage("images/player6.png"), color: "rgb(50,255,50)" }, // 5: EMERALD
  { img: loadImage("images/player7.png"), color: "rgb(200,50,255)" }, // 6: AMETHYST
  { img: loadImage("images/player8.png"), color: "rgb(60,60,60)" }, // 7: SHADOW
  { img: loadImage("images/player9.png"), color: "rgb(255,215,0)" }, // 8: CHAMPION (1位限定)
  { img: loadImage("images/player10.png"), color: "rgb(200,200,210)" }, // 9: RUNNER-UP (2位限定)
  { img: loadImage("images/player11.png"), color: "rgb(205,127,50)" }, // 10: THIRD (3位限定)
  { img: loadImage("images/player12.png"), color: "rgb(150,220,255)" }, // 11: FROST
  { img: loadImage("images/player13.png"), color: "rgb(255,90,20)" }, // 12: MAGMA
  { img: loadImage("images/player14.png"), color: "rgb(120,255,60)" }, // 13: TOXIC
  { img: loadImage("images/player15.png"), color: "rgb(255,120,200)" }, // 14: NEON
  { img: loadImage("images/player16.png"), color: "rgb(180,140,255)" }, // 15: COSMIC
  { img: loadImage("images/player17.png"), color: "rgb(255,235,120)" }, // 16: RADIANT
];

function getSkinDrawable(i) {
  const sk = playerSkins[i];
  if (isDrawable(sk.img)) return sk.img;
  if (i === 0) return isDrawable(IMG.player) ? IMG.player : null;
  if (isDrawable(IMG.player)) {
    if (!sk.tinted) sk.tinted = makeTinted(IMG.player, sk.color, 50, 40);
    return sk.tinted;
  }
  return null;
}

// ============================================================
// グローバル状態
// ============================================================
let stage = 1;
let hell_mode_active = false;
let hell_stage1_clear = false;
let hard_mode_unlocked = false;
let hell_mode_unlocked = false;
let player_rank = 0; // 現在ランキングでの自分の順位（1/2/3で該当スキン解放、0=圏外）

let player, enemies, bullets, boss_bullets, enemy_bullets, items, particles;
let score, stage_score, lives, last_shot_time, boss, boss_spawned, bg_y;
let stage_clear, clear_time, bomb_stock, bomb_active_timer;

let menu = true;
let tutorial = false;
let skin_menu = false;
let cursor_skin = 0;
let game_over = false;
let running = true;

const shot_delay = 180; // 連射スピード（180ms）

// コナミコマンド／HELL コマンド
const KONAMI_CODE = [
  "ArrowUp", "ArrowUp",
  "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight",
  "ArrowLeft", "ArrowRight",
  "KeyB", "KeyA",
];
const HELL_CODE = ["KeyH", "KeyE", "KeyL", "KeyL"];
let konami_buffer = [];
let hell_buffer = [];

// 永続データ
let achievements, selected_skin, player_uuid, player_name, hell_code_revealed;
let ranking = [];

// ============================================================
// 永続化（localStorage）
// ============================================================
function load_achievements() {
  const achieve = { high_score: 0, max_stage: 1, total_score: 0 };
  const hs = localStorage.getItem("haniwa_high_score");
  const ms = localStorage.getItem("haniwa_max_stage");
  const ts = localStorage.getItem("haniwa_total_score");
  if (hs) achieve.high_score = parseInt(hs, 10);
  if (ms) achieve.max_stage = parseInt(ms, 10);
  if (ts) achieve.total_score = parseInt(ts, 10);
  return achieve;
}
function save_achievements(a) {
  localStorage.setItem("haniwa_high_score", String(a.high_score));
  localStorage.setItem("haniwa_max_stage", String(a.max_stage));
  localStorage.setItem("haniwa_total_score", String(a.total_score));
}
function load_selected_skin() {
  const s = localStorage.getItem("haniwa_selected_skin");
  return s ? parseInt(s, 10) : 0;
}
function save_selected_skin(id) {
  localStorage.setItem("haniwa_selected_skin", String(id));
}
function load_hell_revealed() {
  return localStorage.getItem("haniwa_hell_revealed") === "true";
}
function save_hell_revealed() {
  hell_code_revealed = true;
  localStorage.setItem("haniwa_hell_revealed", "true");
}
// HELLモードでステージ1をクリアしたか（スキン解放条件）
function load_hell_stage1_clear() {
  return localStorage.getItem("haniwa_hell_stage1") === "true";
}
function unlock_hell_stage1_clear() {
  if (!hell_stage1_clear) {
    hell_stage1_clear = true;
    localStorage.setItem("haniwa_hell_stage1", "true");
  }
}

// ローカルランキング（TOP10）の読み込み・保存
function load_ranking() {
  try {
    const r = JSON.parse(localStorage.getItem("haniwa_ranking") || "[]");
    return Array.isArray(r) ? r : [];
  } catch (e) {
    return [];
  }
}
function save_ranking(list) {
  localStorage.setItem("haniwa_ranking", JSON.stringify(list));
}
// 1 プレイ分のスコアをランキングに集計し、スコア→ステージ順で TOP10 に絞る
function add_to_ranking(name, sc, st) {
  const list = load_ranking();
  list.push({ uuid: player_uuid, name: name, score: Math.trunc(sc), stage: Math.trunc(st), date: Date.now() });
  list.sort((a, b) => b.score - a.score || b.stage - a.stage);
  const top = list.slice(0, 10);
  save_ranking(top);
  ranking = top;
  updateRankingDOM();
  return top;
}
function load_or_create_uuid() {
  let u = localStorage.getItem("haniwa_player_uuid");
  if (!u) {
    u = (crypto && crypto.randomUUID) ? crypto.randomUUID() : "u-" + Date.now() + "-" + Math.random();
    localStorage.setItem("haniwa_player_uuid", u);
  }
  return u;
}
function get_saved_player_name() {
  const name = localStorage.getItem("haniwa_player_name");
  if (name) return name.trim().slice(0, 10);
  return "Player";
}
function change_player_name() {
  const current = get_saved_player_name();
  const nn = window.prompt("Enter your name (max 10 chars):", current);
  if (nn !== null) {
    const trimmed = nn.trim().slice(0, 10);
    if (trimmed) {
      localStorage.setItem("haniwa_player_name", trimmed);
      return trimmed;
    }
  }
  return current;
}

// スキン解放条件
function is_skin_unlocked(id) {
  switch (id) {
    case 0: return true;
    case 1: return achievements.high_score >= 30 || achievements.total_score >= 100;
    case 2: return achievements.max_stage >= 3 || achievements.high_score >= 60;
    case 3: return achievements.total_score >= 200;
    case 4: return achievements.high_score >= 80;
    case 5: return achievements.max_stage >= 5;
    case 6: return achievements.total_score >= 500;
    case 7: return achievements.max_stage >= 8 || achievements.high_score >= 150 || hell_stage1_clear;
    case 8: return player_rank === 1;
    case 9: return player_rank === 2;
    case 10: return player_rank === 3;
    case 11: return achievements.total_score >= 1000;
    case 12: return achievements.high_score >= 200;
    case 13: return achievements.max_stage >= 10;
    case 14: return achievements.high_score >= 300 || achievements.total_score >= 2000;
    case 15: return achievements.max_stage >= 12 && achievements.high_score >= 250;
    case 16: return achievements.total_score >= 5000;
  }
  return false;
}
function get_skin_name(id) {
  switch (id) {
    case 0: return "NORMAL";
    case 1: return "SILVER (Score 30 or Total 100)";
    case 2: return "GOLD (Stage 3 or Score 60)";
    case 3: return "CYBER (Total Score 200)";
    case 4: return "RUBY (High Score 80)";
    case 5: return "EMERALD (Max Stage 5)";
    case 6: return "AMETHYST (Total Score 500)";
    case 7: return "SHADOW (Stage 8 / Score 150 / HELL St.1 Clear)";
    case 8: return "CHAMPION (Rank #1 Only)";
    case 9: return "RUNNER-UP (Rank #2 Only)";
    case 10: return "THIRD (Rank #3 Only)";
    case 11: return "FROST (Total Score 1000)";
    case 12: return "MAGMA (High Score 200)";
    case 13: return "TOXIC (Max Stage 10)";
    case 14: return "NEON (Score 300 or Total 2000)";
    case 15: return "COSMIC (Stage 12 and Score 250)";
    case 16: return "RADIANT (Total Score 5000)";
  }
  return "UNKNOWN";
}

// ランキング内での自分の順位を判定（uuid優先、無ければ名前で照合）
function load_rank() {
  return parseInt(localStorage.getItem("haniwa_rank") || "0", 10) || 0;
}
function player_rank_in(list) {
  if (!Array.isArray(list)) return 0;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e) continue;
    const byUuid = e.uuid != null && player_uuid != null && String(e.uuid) === String(player_uuid);
    const byName = e.uuid == null && String(e.name) === String(player_name);
    if (byUuid || byName) return i + 1;
  }
  return 0;
}
// 表示中ランキングとローカル記録の両方から順位を求め、上位（小さい方）を採用
function update_rank_status(list) {
  const shownRank = player_rank_in(list);
  const localRank = player_rank_in(load_ranking());
  const ranks = [shownRank, localRank].filter((r) => r > 0);
  const best = ranks.length ? Math.min.apply(null, ranks) : 0;
  if (best !== player_rank) {
    player_rank = best;
    localStorage.setItem("haniwa_rank", String(best));
  }
}

// GAS へ非同期でスコア送信
async function send_score_to_gas(playerName, sc, st) {
  if (!GAS_URL || GAS_URL.indexOf("あなたのGAS") !== -1) {
    console.log("GAS URL is not configured.");
    return;
  }
  const payload = {
    uuid: player_uuid,
    name: playerName,
    score: Math.trunc(sc),
    stage: Math.trunc(st),
  };
  try {
    await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "text/plain" },
    });
    console.log("Score sent to GAS successfully.");
  } catch (e) {
    console.log("Failed to send score to GAS:", e);
  }
}

// ============================================================
// 入力
// ============================================================
const keys = {}; // 押下中キー（get_pressed 相当）
const eventQueue = []; // KEYDOWN イベントキュー

function isDown(...codes) {
  return codes.some((c) => keys[c]);
}

window.addEventListener("keydown", (e) => {
  const block = [
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space",
    "KeyW", "KeyA", "KeyS", "KeyD",
  ];
  if (block.includes(e.code)) e.preventDefault();
  if (e.repeat) return; // オートリピートは KEYDOWN 扱いにしない（pygame 準拠）
  keys[e.code] = true;
  eventQueue.push(e.code);
});
window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

// ============================================================
// エンティティ
// ============================================================
class Player {
  constructor() {
    this.skin = is_skin_unlocked(selected_skin) ? selected_skin : 0;
    this.rect = new Rect(0, 0, 50, 40);
    this.rect.centerx = WIDTH / 2;
    this.rect.bottom = HEIGHT - 10;
    this.base_speed = 5;
    this.speed = this.base_speed;

    this.speed_timer = 0;
    this.power_timer = 0;
    this.triple_timer = 0;
    this.power_boost_timer = 0;
    this.invincible_timer = 0;
    this.has_shield = false;
    this.is_slow = false;
    this.facing = -1; // -1: 左（通常画像） / 1: 右（左右反転）
  }

  update() {
    let dx = 0, dy = 0;
    if (isDown("ArrowLeft", "KeyA")) dx = -1;
    if (isDown("ArrowRight", "KeyD")) dx = 1;
    if (isDown("ArrowUp", "KeyW")) dy = -1;
    if (isDown("ArrowDown", "KeyS")) dy = 1;

    let max_speed;
    if (this.speed_timer > 0) {
      this.speed_timer -= 1;
      max_speed = 8;
    } else {
      max_speed = this.base_speed;
    }

    if (isDown("ShiftLeft", "ShiftRight")) {
      this.speed = max_speed * 0.4;
      this.is_slow = true;
    } else {
      this.speed = max_speed;
      this.is_slow = false;
    }

    if (this.power_timer > 0) this.power_timer -= 1;
    if (this.triple_timer > 0) this.triple_timer -= 1;
    if (this.power_boost_timer > 0) this.power_boost_timer -= 1;
    if (this.invincible_timer > 0) this.invincible_timer -= 1;

    let current_speed = this.speed;
    if (dx !== 0 && dy !== 0) current_speed = this.speed * 0.7071;

    if (dx < 0) this.facing = -1;
    else if (dx > 0) this.facing = 1;

    if (dx < 0 && this.rect.left > 0) this.rect.x += Math.trunc(dx * current_speed);
    else if (dx > 0 && this.rect.right < WIDTH) this.rect.x += Math.trunc(dx * current_speed);

    if (dy < 0 && this.rect.top > HEIGHT / 2) this.rect.y += Math.trunc(dy * current_speed);
    else if (dy > 0 && this.rect.bottom < HEIGHT - 10) this.rect.y += Math.trunc(dy * current_speed);
  }

  shoot() {
    const boosted = this.power_boost_timer > 0;
    const dmg = boosted ? 2 : 1;
    // 攻撃力アップ中はオレンジ / 3wayは紫 / 2wayは水色 / 通常は白
    let color;
    if (boosted) color = "rgb(255,120,0)";
    else if (this.triple_timer > 0) color = "rgb(200,90,255)";
    else if (this.power_timer > 0) color = "rgb(80,200,255)";
    else color = WHITE;

    if (this.triple_timer > 0) {
      addTo(bullets, new Bullet(this.rect.centerx, this.rect.top, 0, dmg, color));
      addTo(bullets, new Bullet(this.rect.left, this.rect.top, -2, dmg, color));
      addTo(bullets, new Bullet(this.rect.right, this.rect.top, 2, dmg, color));
    } else if (this.power_timer > 0) {
      addTo(bullets, new Bullet(this.rect.left + 5, this.rect.top, 0, dmg, color));
      addTo(bullets, new Bullet(this.rect.right - 5, this.rect.top, 0, dmg, color));
    } else {
      addTo(bullets, new Bullet(this.rect.centerx, this.rect.top, 0, dmg, color));
    }
    play_shoot_se();
  }

  draw() {
    const d = getSkinDrawable(this.skin);
    if (d) {
      // player5(RUBY, skin 4) は右移動時に左右反転
      if (this.skin === 4 && this.facing === 1) {
        ctx.save();
        ctx.translate(this.rect.x + this.rect.width, this.rect.y);
        ctx.scale(-1, 1);
        ctx.drawImage(d, 0, 0, this.rect.width, this.rect.height);
        ctx.restore();
      } else {
        ctx.drawImage(d, this.rect.x, this.rect.y, this.rect.width, this.rect.height);
      }
    } else {
      ctx.fillStyle = playerSkins[this.skin].color;
      ctx.fillRect(this.rect.x, this.rect.y, this.rect.width, this.rect.height);
    }
  }
}

class Bullet {
  constructor(x, y, speed_x = 0, damage = 1, color = null) {
    this.damage = damage;
    this.color = color || (damage > 1 ? "rgb(255,120,0)" : WHITE);
    this.rect = new Rect(0, 0, 4, 10);
    this.rect.center = [x, y];
    this.speed_x = speed_x;
    this.speed = -10;
  }
  update() {
    this.rect.x += this.speed_x;
    this.rect.y += this.speed;
    if (this.rect.bottom < 0 || this.rect.right < 0 || this.rect.left > WIDTH) killSprite(this);
  }
  draw() {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.rect.x, this.rect.y, this.rect.width, this.rect.height);
  }
}

class EnemyBullet {
  constructor(x, y, speed_x = 0, speed_y = 5) {
    this.rect = new Rect(0, 0, 4, 8);
    this.rect.center = [x, y];
    this.speed_x = speed_x;
    this.speed_y = speed_y;
  }
  update() {
    this.rect.x += this.speed_x;
    this.rect.y += this.speed_y;
    if (this.rect.top > HEIGHT || this.rect.bottom < 0 || this.rect.left < 0 || this.rect.right > WIDTH) killSprite(this);
  }
  draw() {
    ctx.fillStyle = "rgb(255,150,50)";
    ctx.fillRect(this.rect.x, this.rect.y, this.rect.width, this.rect.height);
  }
}

class Enemy {
  constructor(type = 1) {
    this.type = type;
    this.hp = 1;
    let w = 40, h = 30;

    const speed_bonus = (stage - 1) * 0.5 + (hell_mode_active ? 2.0 : 0);

    if (type === 1) {
      this.img = IMG.enemy1; this.color = "rgb(220,60,60)"; w = 40; h = 30;
      this.speed = randint(3, 5) + speed_bonus;
    } else if (type === 2) {
      this.img = IMG.enemy2; this.color = "rgb(60,180,60)"; w = 60; h = 50;
      this.speed = randint(1, 2) + speed_bonus;
    } else if (type === 3) {
      this.img = IMG.slime_purple; this.color = "rgb(170,60,255)"; w = 40; h = 30;
      this.speed = randint(2, 3) + speed_bonus;
      this.angle_speed = uniform(0.05, 0.1);
      this.amplitude = randint(2, 4);
      this.angle = uniform(0, 2 * Math.PI);
    } else if (type === 4) {
      this.img = IMG.slime_red; this.color = "rgb(255,70,70)"; w = 40; h = 30;
      this.speed = randint(6, 8) + speed_bonus;
    } else if (type === 5) {
      this.img = IMG.enemy1; this.color = "rgb(255,120,80)"; w = 40; h = 30;
      this.speed = randint(2, 3) + speed_bonus;
      this.last_shot = performance.now();
      const delay_bonus = (stage - 1) * 150;
      const min_delay = hell_mode_active ? 600 : 1000;
      this.shoot_delay = Math.max(randint(1500, 2500) - delay_bonus, min_delay);
    } else if (type === 6) {
      this.img = IMG.enemy2; this.color = "rgb(200,120,40)"; w = 60; h = 50;
      this.speed = 1;
      this.state = "wait";
      this.wait_timer = performance.now();
      this.dash_speed_y = 8 + speed_bonus;
      this.speed_x = 0;
    } else if (type === 7) {
      this.img = IMG.enemy2; this.color = "rgb(120,120,140)"; w = 90; h = 75;
      this.speed = uniform(0.8, 1.5) + speed_bonus * 0.3;
      this.hp = 3;
    } else if (type === 8) {
      this.img = IMG.enemy3; this.color = "rgb(255,170,60)"; w = 40; h = 30;
      this.speed = randint(3, 4) + speed_bonus * 0.7;
    } else if (type === 9) {
      this.img = IMG.enemy4; this.color = "rgb(60,170,255)"; w = 50; h = 40;
      this.speed = 1.5 + speed_bonus * 0.3;
      this.hp = 2;
    }

    this.rect = new Rect(0, 0, w, h);
    this.rect.x = randint(0, WIDTH - w);
    this.rect.y = randint(-100, -40);
  }

  update() {
    const now = performance.now();

    if (this.type === 5) {
      if (now - this.last_shot > this.shoot_delay) {
        this.last_shot = now;
        if (hell_mode_active) {
          const dx = player.rect.centerx - this.rect.centerx;
          const dy = player.rect.centery - this.rect.bottom;
          const dist = hypot(dx, dy);
          let base_sx, base_sy;
          if (dist !== 0) { base_sx = (dx / dist) * 4.0; base_sy = (dy / dist) * 4.0; }
          else { base_sx = 0; base_sy = 4.0; }
          addTo(enemy_bullets, new EnemyBullet(this.rect.centerx, this.rect.bottom, base_sx, base_sy));
          addTo(enemy_bullets, new EnemyBullet(this.rect.centerx, this.rect.bottom, base_sx - 1.0, base_sy - 0.5));
          addTo(enemy_bullets, new EnemyBullet(this.rect.centerx, this.rect.bottom, base_sx + 1.0, base_sy - 0.5));
        } else {
          addTo(enemy_bullets, new EnemyBullet(this.rect.centerx, this.rect.bottom, 0, 5));
        }
      }
      this.rect.y += this.speed;
    } else if (this.type === 6) {
      if (this.state === "wait") {
        this.rect.y += this.speed;
        if (now - this.wait_timer > 1000) {
          this.state = "dash";
          const dx = player.rect.centerx - this.rect.centerx;
          this.speed_x = dx / 30;
          if (this.speed_x > 4) this.speed_x = 4;
          if (this.speed_x < -4) this.speed_x = -4;
        }
      } else if (this.state === "dash") {
        this.rect.y += this.dash_speed_y;
        this.rect.x += Math.trunc(this.speed_x);
      }
    } else if (this.type === 9) {
      this.rect.y += this.speed;
      if (this.rect.y >= HEIGHT / 3) {
        const e1 = new Enemy(4);
        e1.rect.center = this.rect.center;
        e1.rect.x -= 20;
        const e2 = new Enemy(4);
        e2.rect.center = this.rect.center;
        e2.rect.x += 20;
        addTo(enemies, e1);
        addTo(enemies, e2);
        killSprite(this);
      }
    } else {
      this.rect.y += this.speed;
    }

    if (this.type === 3) {
      this.angle += this.angle_speed;
      this.rect.x += Math.trunc(Math.sin(this.angle) * this.amplitude);
      if (this.rect.left < 0) this.rect.left = 0;
      else if (this.rect.right > WIDTH) this.rect.right = WIDTH;
    }

    if (this.rect.top > HEIGHT) killSprite(this);
  }

  draw() {
    drawSprite(this.img, this.rect, this.color);
  }
}

class BossBullet {
  constructor(x, y, speed_x = 0, speed_y = 5, gravity = 0) {
    this.rect = new Rect(0, 0, 6, 12);
    this.rect.center = [x, y];
    this.speed_x = speed_x;
    this.speed_y = speed_y;
    this.gravity = gravity;
  }
  update() {
    this.speed_y += this.gravity;
    this.rect.x += this.speed_x;
    this.rect.y += this.speed_y;
    if (this.rect.top > HEIGHT || this.rect.bottom < 0 || this.rect.left < 0 || this.rect.right > WIDTH) killSprite(this);
  }
  draw() {
    ctx.fillStyle = "rgb(255,50,50)";
    ctx.fillRect(this.rect.x, this.rect.y, this.rect.width, this.rect.height);
  }
}

class SplitBullet {
  constructor(x, y, speed_x, speed_y) {
    this.rect = new Rect(0, 0, 12, 12);
    this.rect.center = [x, y];
    this.speed_x = speed_x;
    this.speed_y = speed_y;
    this.split_y = randint(220, 350);
  }
  update() {
    this.rect.x += this.speed_x;
    this.rect.y += this.speed_y;
    if (this.rect.y >= this.split_y) {
      this.split();
      killSprite(this);
      return;
    }
    if (this.rect.top > HEIGHT || this.rect.bottom < 0 || this.rect.left < 0 || this.rect.right > WIDTH) killSprite(this);
  }
  split() {
    let bullet_speed_y;
    if (hell_mode_active) bullet_speed_y = Math.min(5 + (stage - 1) * 0.5, 9.0);
    else bullet_speed_y = Math.min(4 + (stage - 1) * 0.4, 7.5);
    addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.centery, -2.5, bullet_speed_y, 0));
    addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.centery, 0, bullet_speed_y + 0.5, 0));
    addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.centery, 2.5, bullet_speed_y, 0));
  }
  draw() {
    ctx.fillStyle = "rgb(100,255,100)";
    ctx.fillRect(this.rect.x, this.rect.y, this.rect.width, this.rect.height);
  }
}

class Item {
  constructor(x, y, item_type) {
    this.item_type = item_type;
    const map = {
      green: [IMG.gem_green, "rgb(100,255,100)"],
      cyan: [IMG.gem_cyan, "rgb(100,200,255)"],
      blue: [IMG.gem_blue, "rgb(100,100,255)"],
      yellow: [IMG.gem_yellow, "rgb(255,255,100)"],
      purple: [IMG.gem_purple, "rgb(180,100,255)"],
      orange: [IMG.gem_orange, "rgb(255,120,0)"],
      heart: [IMG.heart, "rgb(255,100,100)"],
    };
    const [img, color] = map[item_type];
    this.img = img;
    this.color = color;
    const size = item_type === "heart" ? 25 : 20;
    this.rect = new Rect(0, 0, size, size);
    this.rect.center = [x, y];
    this.speed = 3;
  }
  update() {
    this.rect.y += this.speed;
    if (this.rect.top > HEIGHT) killSprite(this);
  }
  draw() {
    drawSprite(this.img, this.rect, this.color);
  }
}

class Particle {
  constructor(x, y, color) {
    this.pos_x = x;
    this.pos_y = y;
    this.vx = uniform(-4.0, 4.0);
    this.vy = uniform(-4.0, 4.0);
    this.color = color;
    this.size = randint(2, 5);
    this.lifetime = randint(15, 30);
  }
  update() {
    this.pos_x += this.vx;
    this.pos_y += this.vy;
    this.lifetime -= 1;
  }
  draw() {
    const current_size = Math.max(1, Math.trunc(this.size * (this.lifetime / 30.0)));
    ctx.fillStyle = this.color;
    ctx.fillRect(Math.trunc(this.pos_x), Math.trunc(this.pos_y), current_size, current_size);
  }
}

class Boss {
  constructor() {
    this.boss_type = choice([1, 2, 3, 4, 5, 6, 7]);
    this.dragon_shot_count = 0;
    this.slime_shot_count = 0;

    if (this.boss_type === 1) {
      this.img = IMG.boss; this.color = "rgb(255,60,120)";
      this.boss_name = "DRAGON";
      this.speed_x = 3 + (stage - 1) * 0.5;
      this.speed_y = 1 + (stage - 1) * 0.2;
    } else if (this.boss_type === 2) {
      this.img = IMG.boss2; this.color = "rgb(120,255,180)";
      this.boss_name = "KING SLIME";
      this.speed_x = 2 + (stage - 1) * 0.4;
      this.speed_y = 1.5 + (stage - 1) * 0.3;
      this.jump_angle = 0;
      this.spiral_angle = 0;
      this.spiral_counter = 0;
    } else if (this.boss_type === 3) {
      this.img = IMG.boss3; this.color = "rgb(200,160,120)";
      this.boss_name = "GOLEM";
      this.speed_x = 3 + (stage - 1) * 0.5;
      this.speed_y = 1.5 + (stage - 1) * 0.2;
      this.jump_angle = 0;
    } else if (this.boss_type === 4) {
      // 幽霊: 左右ドリフト＋一定間隔でワープ
      this.img = IMG.boss4; this.color = "rgb(180,120,255)";
      this.boss_name = "PHANTOM";
      this.speed_x = 3 + (stage - 1) * 0.4;
      this.speed_y = 1;
      this.bob_angle = 0;
      this.warp_timer = performance.now();
      this.warp_alpha = 1.0;
    } else if (this.boss_type === 5) {
      // 要塞: ほぼ静止して全方位リング弾
      this.img = IMG.boss5; this.color = "rgb(150,160,190)";
      this.boss_name = "TURRET FORTRESS";
      this.speed_x = 1 + (stage - 1) * 0.2;
      this.speed_y = 0;
      this.ring_angle = 0;
    } else if (this.boss_type === 6) {
      // 高速: 上部を高速往復＋急降下
      this.img = IMG.boss6; this.color = "rgb(80,230,255)";
      this.boss_name = "SPEEDSTER";
      this.speed_x = 6 + (stage - 1) * 0.6;
      this.speed_y = 0;
      this.dash_state = "sweep";
      this.dash_timer = performance.now();
      this.base_y = 70;
    } else {
      // 多頭: 複数パターン同時発射
      this.img = IMG.boss7; this.color = "rgb(120,220,120)";
      this.boss_name = "HYDRA";
      this.speed_x = 2 + (stage - 1) * 0.3;
      this.speed_y = 0;
      this.wave_angle = 0;
    }

    this.rect = new Rect(0, 0, 100, 80);
    this.rect.centerx = WIDTH / 2;
    this.rect.top = 50;

    if (hell_mode_active) {
      this.speed_x += 1.5;
      this.speed_y += 0.5;
      this.max_hp = 50 + (stage - 1) * 15;
    } else {
      this.max_hp = 30 + (stage - 1) * 10;
    }
    this.hp = this.max_hp;

    this.last_shot = performance.now();
    this.last_move_change = performance.now();
  }

  update() {
    const now = performance.now();

    if (this.boss_type === 1) {
      if (now - this.last_move_change > 1000) {
        this.speed_x = choice([-4, -2, 2, 4]);
        this.speed_y = choice([-2, -1, 1, 2]);
        this.last_move_change = now;
      }
      this.rect.x += this.speed_x;
      this.rect.y += this.speed_y;
      if (this.rect.left <= 0 || this.rect.right >= WIDTH) this.speed_x *= -1;
      if (this.rect.top <= 0 || this.rect.bottom >= HEIGHT / 2) this.speed_y *= -1;
    } else if (this.boss_type === 2) {
      this.rect.x += this.speed_x;
      this.jump_angle += 0.05;
      this.rect.y = 50 + Math.trunc(Math.abs(Math.sin(this.jump_angle)) * (HEIGHT / 3));
      if (this.rect.left <= 0 || this.rect.right >= WIDTH) this.speed_x *= -1;
    } else if (this.boss_type === 3) {
      this.jump_angle += 0.02;
      this.rect.centerx = WIDTH / 2 + Math.trunc(Math.sin(this.jump_angle * 2.0) * (WIDTH / 3));
      this.rect.centery = 100 + Math.trunc(Math.cos(this.jump_angle) * 40.0);
    } else if (this.boss_type === 4) {
      // PHANTOM: 左右ドリフト＋上下の揺れ、一定間隔でプレイヤー付近へワープ
      this.bob_angle += 0.08;
      this.rect.x += this.speed_x;
      if (this.rect.left <= 0 || this.rect.right >= WIDTH) this.speed_x *= -1;
      this.rect.centery = 90 + Math.trunc(Math.sin(this.bob_angle) * 30);
      const warp_interval = hell_mode_active ? 1600 : 2200;
      if (now - this.warp_timer > warp_interval) {
        this.warp_timer = now;
        const target = player.rect.centerx + randint(-80, 80);
        this.rect.centerx = Math.max(this.rect.width / 2, Math.min(WIDTH - this.rect.width / 2, target));
        // ワープ直後に自機狙い弾（フェイント）
        this.warp_burst = true;
      }
    } else if (this.boss_type === 5) {
      // TURRET FORTRESS: ゆっくり左右のみ
      this.rect.x += this.speed_x;
      if (this.rect.left <= 0 || this.rect.right >= WIDTH) this.speed_x *= -1;
      this.rect.top = 50;
    } else if (this.boss_type === 6) {
      // SPEEDSTER: 上部を高速往復し、時々急降下して戻る
      if (this.dash_state === "sweep") {
        this.rect.x += this.speed_x;
        if (this.rect.left <= 0 || this.rect.right >= WIDTH) this.speed_x *= -1;
        this.rect.top = this.base_y;
        const dive_interval = hell_mode_active ? 2200 : 3000;
        if (now - this.dash_timer > dive_interval) {
          this.dash_state = "dive";
          this.dash_timer = now;
        }
      } else {
        // 急降下→戻る
        this.rect.x += this.speed_x * 0.5;
        this.rect.y += 12;
        if (this.rect.bottom >= HEIGHT / 2) {
          this.dash_state = "sweep";
          this.dash_timer = now;
        }
        if (this.rect.left <= 0 || this.rect.right >= WIDTH) this.speed_x *= -1;
      }
    } else {
      // HYDRA: 緩やかに左右移動
      this.wave_angle += 0.04;
      this.rect.x += this.speed_x;
      if (this.rect.left <= 0 || this.rect.right >= WIDTH) this.speed_x *= -1;
      this.rect.top = 50;
    }

    let shot_delay_b;
    if (this.hp <= this.max_hp * 0.3) {
      if (this.boss_type === 2) shot_delay_b = 100;
      else if (this.boss_type === 3) shot_delay_b = hell_mode_active ? 250 : 350;
      else shot_delay_b = hell_mode_active ? 200 : 300;
    } else {
      if (hell_mode_active) shot_delay_b = Math.max(400 - (stage - 1) * 30, 250);
      else shot_delay_b = Math.max(800 - (stage - 1) * 50, 450);
    }

    if (now - this.last_shot > shot_delay_b) {
      this.last_shot = now;
      this.shoot();
    }
  }

  shoot() {
    const max_speed = hell_mode_active ? 10.0 : 8.5;
    let bullet_speed_y = Math.min(5 + (stage - 1) * 0.5, max_speed);
    if (hell_mode_active) bullet_speed_y += 1.5;

    if (this.boss_type === 1) {
      // ドラゴン
      if (this.hp > this.max_hp * 0.66) {
        if (hell_mode_active) {
          const dx = player.rect.centerx - this.rect.centerx;
          const dy = player.rect.centery - this.rect.bottom;
          const dist = hypot(dx, dy);
          const base_sx = dist !== 0 ? (dx / dist) * (bullet_speed_y + 1.0) : 0;
          const base_sy = dist !== 0 ? (dy / dist) * (bullet_speed_y + 1.0) : bullet_speed_y + 1.0;
          addTo(boss_bullets, new BossBullet(this.rect.centerx - 12, this.rect.bottom, base_sx - 0.8, base_sy, 0));
          addTo(boss_bullets, new BossBullet(this.rect.centerx + 12, this.rect.bottom, base_sx + 0.8, base_sy, 0));
        } else {
          addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.bottom, 0, bullet_speed_y, 0));
        }
      } else if (this.hp > this.max_hp * 0.33 && this.hp <= this.max_hp * 0.66) {
        if (hell_mode_active) {
          this.dragon_shot_count += 1;
          if (this.dragon_shot_count % 3 === 0) {
            addTo(boss_bullets, new SplitBullet(this.rect.centerx, this.rect.bottom, 0, bullet_speed_y - 1));
            addTo(boss_bullets, new BossBullet(this.rect.centerx - 15, this.rect.bottom, -1.5, bullet_speed_y, 0));
            addTo(boss_bullets, new BossBullet(this.rect.centerx + 15, this.rect.bottom, 1.5, bullet_speed_y, 0));
          } else {
            const dx = player.rect.centerx - this.rect.centerx;
            const dy = player.rect.centery - this.rect.bottom;
            const dist = hypot(dx, dy);
            const base_sx = dist !== 0 ? (dx / dist) * (bullet_speed_y + 0.5) : 0;
            const base_sy = dist !== 0 ? (dy / dist) * (bullet_speed_y + 0.5) : bullet_speed_y + 0.5;
            addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.bottom, base_sx, base_sy, 0));
            addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.bottom, base_sx - 1.2, base_sy - 0.2, 0));
            addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.bottom, base_sx + 1.2, base_sy - 0.2, 0));
          }
        } else {
          addTo(boss_bullets, new SplitBullet(this.rect.centerx, this.rect.bottom, 0, bullet_speed_y - 1));
          addTo(boss_bullets, new BossBullet(this.rect.centerx - 15, this.rect.bottom, -1.5, bullet_speed_y, 0));
          addTo(boss_bullets, new BossBullet(this.rect.centerx + 15, this.rect.bottom, 1.5, bullet_speed_y, 0));
        }
      } else {
        if (hell_mode_active) {
          this.dragon_shot_count += 1;
          if (this.dragon_shot_count % 2 === 1) {
            addTo(boss_bullets, new SplitBullet(this.rect.centerx - 24, this.rect.bottom, -2.4, bullet_speed_y - 1));
            addTo(boss_bullets, new SplitBullet(this.rect.centerx - 12, this.rect.bottom, -1.2, bullet_speed_y - 1));
            addTo(boss_bullets, new SplitBullet(this.rect.centerx, this.rect.bottom, 0, bullet_speed_y - 1));
            addTo(boss_bullets, new SplitBullet(this.rect.centerx + 12, this.rect.bottom, 1.2, bullet_speed_y - 1));
            addTo(boss_bullets, new SplitBullet(this.rect.centerx + 24, this.rect.bottom, 2.4, bullet_speed_y - 1));
          } else {
            const p_angle = Math.atan2(player.rect.centery - this.rect.centery, player.rect.centerx - this.rect.centerx);
            const count = 12;
            for (let i = 0; i < count; i++) {
              const angle = (2 * Math.PI / count) * i;
              let angle_diff = Math.abs(angle - p_angle);
              if (angle_diff > Math.PI) angle_diff = 2 * Math.PI - angle_diff;
              if (angle_diff < (2 * Math.PI / count) * 0.8) continue;
              const sx = Math.cos(angle) * (bullet_speed_y * 0.9);
              const sy = Math.sin(angle) * (bullet_speed_y * 0.9);
              addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.centery, sx, sy, 0));
            }
          }
        } else {
          const split_count = Math.min(2 + Math.trunc((stage - 1) / 3), 4);
          if (split_count === 2) {
            addTo(boss_bullets, new SplitBullet(this.rect.centerx - 10, this.rect.bottom, -1, bullet_speed_y - 1));
            addTo(boss_bullets, new SplitBullet(this.rect.centerx + 10, this.rect.bottom, 1, bullet_speed_y - 1));
          } else if (split_count === 3) {
            addTo(boss_bullets, new SplitBullet(this.rect.centerx - 15, this.rect.bottom, -1.5, bullet_speed_y - 1));
            addTo(boss_bullets, new SplitBullet(this.rect.centerx, this.rect.bottom, 0, bullet_speed_y - 1));
            addTo(boss_bullets, new SplitBullet(this.rect.centerx + 15, this.rect.bottom, 1.5, bullet_speed_y));
          } else {
            addTo(boss_bullets, new SplitBullet(this.rect.centerx - 20, this.rect.bottom, -2, bullet_speed_y - 1));
            addTo(boss_bullets, new SplitBullet(this.rect.centerx - 7, this.rect.bottom, -0.7, bullet_speed_y - 1));
            addTo(boss_bullets, new SplitBullet(this.rect.centerx + 7, this.rect.bottom, 0.7, bullet_speed_y - 1));
            addTo(boss_bullets, new SplitBullet(this.rect.centerx + 20, this.rect.bottom, 2, bullet_speed_y - 1));
          }
        }
      }
    } else if (this.boss_type === 2) {
      // キングスライム
      if (this.hp > this.max_hp * 0.66) {
        const dx = player.rect.centerx - this.rect.centerx;
        const dy = player.rect.centery - this.rect.bottom;
        const dist = hypot(dx, dy);
        const speed_x = dist !== 0 ? (dx / dist) * bullet_speed_y : 0;
        const speed_y = dist !== 0 ? (dy / dist) * bullet_speed_y : bullet_speed_y;
        if (hell_mode_active) {
          addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.bottom, speed_x, speed_y, 0));
          addTo(boss_bullets, new BossBullet(this.rect.centerx - 20, this.rect.top, -3.0, -4.0, 0.15));
          addTo(boss_bullets, new BossBullet(this.rect.centerx + 20, this.rect.top, 3.0, -4.0, 0.15));
        } else {
          addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.bottom, speed_x, speed_y, 0));
        }
      } else if (this.hp > this.max_hp * 0.33 && this.hp <= this.max_hp * 0.66) {
        const dx = player.rect.centerx - this.rect.centerx;
        const dy = player.rect.centery - this.rect.bottom;
        const dist = hypot(dx, dy);
        const speed_x = dist !== 0 ? (dx / dist) * bullet_speed_y : 0;
        const speed_y = dist !== 0 ? (dy / dist) * bullet_speed_y : bullet_speed_y;
        if (hell_mode_active) {
          this.slime_shot_count += 1;
          if (this.slime_shot_count % 3 === 0) {
            const p_angle = Math.atan2(player.rect.centery - this.rect.centery, player.rect.centerx - this.rect.centerx);
            const count = 10;
            for (let i = 0; i < count; i++) {
              const angle = (2 * Math.PI / count) * i;
              let angle_diff = Math.abs(angle - p_angle);
              if (angle_diff > Math.PI) angle_diff = 2 * Math.PI - angle_diff;
              if (angle_diff < (2 * Math.PI / count) * 0.8) continue;
              const sx = Math.cos(angle) * (bullet_speed_y * 0.5);
              const sy = Math.sin(angle) * (bullet_speed_y * 0.5);
              addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.centery, sx, sy, 0));
            }
          } else {
            addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.bottom, speed_x, speed_y, 0));
            addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.bottom, speed_x - 1.5, speed_y - 0.3, 0));
            addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.bottom, speed_x + 1.5, speed_y - 0.3, 0));
            addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.bottom, speed_x - 3.0, speed_y - 0.8, 0));
            addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.bottom, speed_x + 3.0, speed_y - 0.8, 0));
          }
        } else {
          addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.bottom, speed_x, speed_y, 0));
          addTo(boss_bullets, new BossBullet(this.rect.centerx - 20, this.rect.bottom, -2, bullet_speed_y - 1, 0));
          addTo(boss_bullets, new BossBullet(this.rect.centerx + 20, this.rect.bottom, 2, bullet_speed_y - 1, 0));
        }
      } else {
        this.spiral_counter += 1;
        const skip_trigger = hell_mode_active ? [7, 0] : [5, 0];
        if (skip_trigger.includes(this.spiral_counter % 8)) {
          // 休止
        } else {
          if (hell_mode_active) {
            const offsets = [0, 90, 180, 270];
            const revOffsets = [45, 135, 225, 315];
            const speeds = [];
            for (const o of offsets) {
              const a = radians(this.spiral_angle + o);
              speeds.push([Math.cos(a) * (bullet_speed_y * 0.6), Math.sin(a) * (bullet_speed_y * 0.6)]);
            }
            for (const o of revOffsets) {
              const a = radians(-this.spiral_angle + o);
              speeds.push([Math.cos(a) * (bullet_speed_y * 0.6), Math.sin(a) * (bullet_speed_y * 0.6)]);
            }
            for (const [sx, sy] of speeds) {
              addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.centery, sx, sy, 0));
            }
            this.spiral_angle += 10;
          } else {
            const a1 = radians(this.spiral_angle);
            const a2 = radians(this.spiral_angle + 180);
            addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.centery, Math.cos(a1) * (bullet_speed_y * 0.7), Math.sin(a1) * (bullet_speed_y * 0.7), 0));
            addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.centery, Math.cos(a2) * (bullet_speed_y * 0.7), Math.sin(a2) * (bullet_speed_y * 0.7), 0));
            this.spiral_angle += 15;
          }
          if (this.spiral_angle >= 360) this.spiral_angle -= 360;
        }
      }
    } else if (this.boss_type === 3) {
      // ゴーレム
      if (this.hp > this.max_hp * 0.66) {
        addTo(boss_bullets, new BossBullet(this.rect.centerx - 20, this.rect.top, -3.0, -4.0, 0.15));
        addTo(boss_bullets, new BossBullet(this.rect.centerx - 10, this.rect.top, -1.5, -5.0, 0.15));
        addTo(boss_bullets, new BossBullet(this.rect.centerx + 10, this.rect.top, 1.5, -5.0, 0.15));
        addTo(boss_bullets, new BossBullet(this.rect.centerx + 20, this.rect.top, 3.0, -4.0, 0.15));
      } else if (this.hp > this.max_hp * 0.33 && this.hp <= this.max_hp * 0.66) {
        const dx = player.rect.centerx - this.rect.centerx;
        const dy = player.rect.centery - this.rect.bottom;
        const dist = hypot(dx, dy);
        const speed_x = dist !== 0 ? (dx / dist) * bullet_speed_y : 0;
        const speed_y = dist !== 0 ? (dy / dist) * bullet_speed_y : bullet_speed_y;
        addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.bottom, speed_x, speed_y, 0));
        addTo(boss_bullets, new SplitBullet(this.rect.centerx - 15, this.rect.bottom, -1.5, bullet_speed_y - 1));
        addTo(boss_bullets, new SplitBullet(this.rect.centerx + 15, this.rect.bottom, 1.5, bullet_speed_y - 1));
      } else {
        const p_angle = Math.atan2(player.rect.centery - this.rect.centery, player.rect.centerx - this.rect.centerx);
        const count = 12;
        for (let i = 0; i < count; i++) {
          const angle = (2 * Math.PI / count) * i;
          let angle_diff = Math.abs(angle - p_angle);
          if (angle_diff > Math.PI) angle_diff = 2 * Math.PI - angle_diff;
          if (angle_diff < (2 * Math.PI / count) * 0.8) continue;
          const sx = Math.cos(angle) * (bullet_speed_y * 0.8);
          const sy = Math.sin(angle) * (bullet_speed_y * 0.8);
          addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.centery, sx, sy, 0));
        }
      }
    } else if (this.boss_type === 4) {
      // PHANTOM: 自機狙いスプレッド（ワープ直後は密度UP）＋低HPで全方位
      const dx = player.rect.centerx - this.rect.centerx;
      const dy = player.rect.centery - this.rect.bottom;
      const dist = hypot(dx, dy);
      const ax = dist !== 0 ? dx / dist : 0;
      const ay = dist !== 0 ? dy / dist : 1;
      const sp = bullet_speed_y;
      const spread = this.warp_burst ? 5 : 3;
      this.warp_burst = false;
      const half = (spread - 1) / 2;
      for (let i = 0; i < spread; i++) {
        const off = (i - half) * 0.9;
        addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.bottom, ax * sp + off, ay * sp, 0));
      }
      if (this.hp <= this.max_hp * 0.4) {
        const count = hell_mode_active ? 10 : 8;
        for (let i = 0; i < count; i++) {
          const a = (2 * Math.PI / count) * i;
          addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.centery, Math.cos(a) * sp * 0.6, Math.sin(a) * sp * 0.6, 0));
        }
      }
    } else if (this.boss_type === 5) {
      // TURRET FORTRESS: 回転する全方位リング弾（低HPで弾数増＋自機狙い）
      const base = radians(this.ring_angle);
      let count = this.hp > this.max_hp * 0.5 ? 12 : 16;
      if (hell_mode_active) count += 4;
      const sp = bullet_speed_y * 0.7;
      for (let i = 0; i < count; i++) {
        const a = base + (2 * Math.PI / count) * i;
        addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.centery, Math.cos(a) * sp, Math.sin(a) * sp, 0));
      }
      this.ring_angle += 9;
      if (this.ring_angle >= 360) this.ring_angle -= 360;
      if (this.hp <= this.max_hp * 0.33) {
        const dx = player.rect.centerx - this.rect.centerx;
        const dy = player.rect.centery - this.rect.bottom;
        const dist = hypot(dx, dy);
        const ax = dist !== 0 ? dx / dist : 0;
        const ay = dist !== 0 ? dy / dist : 1;
        addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.bottom, ax * bullet_speed_y, ay * bullet_speed_y, 0));
      }
    } else if (this.boss_type === 6) {
      // SPEEDSTER: 移動軌跡に置き弾。突進中は前方に扇状
      if (this.dash_state === "dive") {
        addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.bottom, -1.5, bullet_speed_y, 0));
        addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.bottom, 0, bullet_speed_y + 1, 0));
        addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.bottom, 1.5, bullet_speed_y, 0));
      } else {
        addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.bottom, 0, bullet_speed_y, 0));
        if (this.hp <= this.max_hp * 0.5) {
          const dx = player.rect.centerx - this.rect.centerx;
          const dy = player.rect.centery - this.rect.bottom;
          const dist = hypot(dx, dy);
          const ax = dist !== 0 ? dx / dist : 0;
          const ay = dist !== 0 ? dy / dist : 1;
          addTo(boss_bullets, new BossBullet(this.rect.centerx, this.rect.bottom, ax * bullet_speed_y, ay * bullet_speed_y, 0));
        }
      }
    } else if (this.boss_type === 7) {
      // HYDRA: 頭ごとに別パターン。HP減で頭が1つずつ封印される
      const heads = this.hp > this.max_hp * 0.66 ? 3 : (this.hp > this.max_hp * 0.33 ? 2 : 1);
      const sp = bullet_speed_y;
      const cx = this.rect.centerx;
      const by = this.rect.bottom;
      // 頭1: 自機狙い狙撃
      {
        const dx = player.rect.centerx - cx;
        const dy = player.rect.centery - by;
        const dist = hypot(dx, dy);
        const ax = dist !== 0 ? dx / dist : 0;
        const ay = dist !== 0 ? dy / dist : 1;
        addTo(boss_bullets, new BossBullet(cx - 30, by, ax * sp, ay * sp, 0));
      }
      if (heads >= 2) {
        // 頭2: 拡散3way
        addTo(boss_bullets, new BossBullet(cx + 30, by, -2, sp, 0));
        addTo(boss_bullets, new BossBullet(cx + 30, by, 0, sp, 0));
        addTo(boss_bullets, new BossBullet(cx + 30, by, 2, sp, 0));
      }
      if (heads >= 3) {
        // 頭3: 波状弾
        const w = Math.sin(this.wave_angle) * 3.5;
        addTo(boss_bullets, new BossBullet(cx, by, w, sp * 0.9, 0));
        addTo(boss_bullets, new BossBullet(cx, by, -w, sp * 0.9, 0));
      }
      if (hell_mode_active) {
        const dx = player.rect.centerx - cx;
        const dy = player.rect.centery - by;
        const dist = hypot(dx, dy);
        const ax = dist !== 0 ? dx / dist : 0;
        const ay = dist !== 0 ? dy / dist : 1;
        addTo(boss_bullets, new BossBullet(cx, by, ax * (sp + 1.5), ay * (sp + 1.5), 0));
      }
    }
  }

  draw() {
    drawSprite(this.img, this.rect, this.color);
  }
}

// ============================================================
// 当たり判定・HUD ヘルパー
// ============================================================
function hitbox_collide(playerObj, sprite2) {
  const hitbox = new Rect(0, 0, 15, 15);
  hitbox.center = playerObj.rect.center;
  return hitbox.colliderect(sprite2.rect);
}
function playerCollide(group, dokill) {
  return spritecollide(player, group, dokill, hitbox_collide);
}

function draw_lives(right_x, y, n, img) {
  for (let i = 0; i < n; i++) {
    const x = right_x - (i + 1) * 22;
    const r = new Rect(x, y, 25, 25);
    drawSprite(img, r, "rgb(255,100,100)");
  }
}
function draw_bombs(right_x, y, n, img) {
  for (let i = 0; i < n; i++) {
    const x = right_x - (i + 1) * 22;
    const r = new Rect(x, y, 20, 20);
    drawSprite(img, r, "rgb(100,100,255)");
  }
}
function draw_boss_hp_bar(b) {
  if (!b) return;
  const bar_width = 100;
  const bar_height = 10;
  const fill = Math.trunc(bar_width * (b.hp / b.max_hp));
  const ox = b.rect.centerx - bar_width / 2;
  const oy = b.rect.top - 15;
  ctx.fillStyle = "rgb(255,0,0)";
  ctx.fillRect(ox, oy, Math.max(0, fill), bar_height);
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 2;
  ctx.strokeRect(ox, oy, bar_width, bar_height);
  drawText(b.boss_name, b.rect.centerx, b.rect.top - 35, 16, WHITE, "center");
}

// ============================================================
// リーダーボード表示（ページ右上の HTML 要素）
//   GAS からオンライン取得を試み、失敗時はローカル TOP10 にフォールバック
// ============================================================
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// リストを HTML 行として描画（online=true なら世界ランキング、false ならローカル記録）
function render_leaderboard(list, online) {
  const body = document.getElementById("ranking-body");
  if (!body) return;
  if (!list || list.length === 0) {
    body.innerHTML = '<div class="rk-empty">No scores yet</div>';
    return;
  }
  let html = "";
  for (let i = 0; i < list.length && i < 10; i++) {
    const r = list[i];
    const cls = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
    const name = escapeHtml(String(r.name || "----").slice(0, 10));
    html +=
      `<div class="rk-row ${cls}">` +
      `<span class="rk-no">${i + 1}.</span>` +
      `<span class="rk-name">${name}</span>` +
      `<span class="rk-score">${r.score}</span>` +
      `<span class="rk-stage">St.${r.stage}</span>` +
      `</div>`;
  }
  if (!online) html += '<div class="rk-note">※ ローカル記録（この端末）</div>';
  body.innerHTML = html;
  update_rank_status(list);
}

// ローカル TOP10 を描画
function updateRankingDOM() {
  render_leaderboard(ranking, false);
}

// ローディング表示
function set_leaderboard_loading() {
  const body = document.getElementById("ranking-body");
  if (body) body.innerHTML = '<div class="rk-loading">読み込み中...</div>';
}

// GAS のレスポンス（配列 / {ranking:[]} / {data:[]} 等）を共通形式へ正規化
function normalize_leaderboard(data) {
  let arr = data;
  if (!Array.isArray(arr)) {
    arr = (data && (data.ranking || data.leaderboard || data.data || data.records || data.rows || data.result)) || [];
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => ({
      uuid: x.uuid != null ? x.uuid : (x.Uuid != null ? x.Uuid : (x.UUID != null ? x.UUID : null)),
      name: x.name != null ? x.name : (x.player != null ? x.player : (x.Name != null ? x.Name : "----")),
      score: Number(x.score != null ? x.score : (x.Score != null ? x.Score : 0)) || 0,
      stage: Number(x.stage != null ? x.stage : (x.Stage != null ? x.Stage : 1)) || 1,
    }))
    .sort((a, b) => b.score - a.score || b.stage - a.stage)
    .slice(0, 10);
}

// オンライン取得を試みる。失敗したらローカル記録にフォールバック
async function fetch_leaderboard() {
  set_leaderboard_loading();
  if (!GAS_URL || GAS_URL.indexOf("あなたのGAS") !== -1) {
    updateRankingDOM();
    return;
  }
  const url = GAS_URL + (GAS_URL.indexOf("?") !== -1 ? "&" : "?") + "action=ranking";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    clearTimeout(timer);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error("GAS response is not JSON");
    }
    const list = normalize_leaderboard(data);
    if (list.length === 0) {
      updateRankingDOM();
    } else {
      render_leaderboard(list, true);
    }
  } catch (e) {
    clearTimeout(timer);
    // オンライン取得できない場合はローカル TOP10 を表示
    updateRankingDOM();
  }
}

// ============================================================
// ゲーム初期化
// ============================================================
function start_game() {
  player = new Player();
  enemies = [];
  bullets = [];
  boss_bullets = [];
  enemy_bullets = [];
  items = [];
  particles = [];

  score = 0;
  stage_score = 0;

  if (hell_mode_unlocked) {
    stage = 1;
    hell_mode_active = true;
  } else if (hard_mode_unlocked) {
    stage = 10;
    score = 100;
    hell_mode_active = false;
  } else {
    stage = 1;
    hell_mode_active = false;
  }

  lives = 3;
  bomb_stock = 2;
  bomb_active_timer = 0;
  last_shot_time = 0;
  boss = null;
  boss_spawned = false;
  bg_y = 0;
  stage_clear = false;
  clear_time = 0;
}

// ============================================================
// イベント処理（毎フレーム、KEYDOWN キューを消化）
// ============================================================
function processEvents() {
  while (eventQueue.length > 0) {
    const key = eventQueue.shift();

    // コナミコマンドバッファ
    konami_buffer.push(key);
    if (konami_buffer.length > KONAMI_CODE.length) konami_buffer.shift();
    // HELL コマンドバッファ
    hell_buffer.push(key);
    if (hell_buffer.length > HELL_CODE.length) hell_buffer.shift();

    // コナミコマンド判定
    if (konami_buffer.length === KONAMI_CODE.length && konami_buffer.every((v, i) => v === KONAMI_CODE[i])) {
      se_clear.play();
      konami_buffer = [];
      if (menu) {
        hard_mode_unlocked = true;
        hell_mode_unlocked = false;
      } else if (game_over) {
        game_over = false;
        lives = 3;
        bomb_stock = 2;
        stage_score = 0;
        boss_spawned = false;
        boss = null;
        enemies.length = 0;
        bullets.length = 0;
        boss_bullets.length = 0;
        enemy_bullets.length = 0;
        items.length = 0;
        particles.length = 0;
        playBgm();
      }
    }

    // HELL コマンド判定
    if (hell_code_revealed && hell_buffer.length === HELL_CODE.length && hell_buffer.every((v, i) => v === HELL_CODE[i])) {
      se_clear.play();
      hell_buffer = [];
      if (menu) {
        hell_mode_unlocked = true;
        hard_mode_unlocked = false;
      }
    }

    if (menu) {
      if (key === "Space") {
        menu = false;
        start_game();
        playBgm();
        hard_mode_unlocked = false;
        hell_mode_unlocked = false;
      } else if (key === "KeyC") {
        menu = false;
        tutorial = true;
        se_hit.play();
      } else if (key === "KeyN") {
        player_name = change_player_name();
        se_hit.play();
      } else if (key === "KeyS") {
        menu = false;
        skin_menu = true;
        cursor_skin = selected_skin;
        se_hit.play();
      }
    } else if (tutorial) {
      if (key === "Space") {
        tutorial = false;
        menu = true;
        se_hit.play();
      }
    } else if (skin_menu) {
      if (key === "ArrowUp") {
        cursor_skin = (cursor_skin - 1 + playerSkins.length) % playerSkins.length;
        se_shoot.play();
      } else if (key === "ArrowDown") {
        cursor_skin = (cursor_skin + 1) % playerSkins.length;
        se_shoot.play();
      } else if (key === "Space" || key === "Enter") {
        if (is_skin_unlocked(cursor_skin)) {
          selected_skin = cursor_skin;
          save_selected_skin(selected_skin);
          skin_menu = false;
          menu = true;
          se_clear.play();
        } else {
          se_damage.play();
        }
      } else if (key === "Escape" || key === "KeyC") {
        skin_menu = false;
        menu = true;
        se_hit.play();
      }
    } else if (game_over && key === "Space") {
      game_over = false;
      menu = true;
      playBgm();
    } else if (!game_over && !menu && !stage_clear) {
      if (key === "KeyX" && bomb_stock > 0 && bomb_active_timer === 0) {
        bomb_stock -= 1;
        bomb_active_timer = 45;
        player.invincible_timer = 120;
        se_explosion.play();

        for (const enemy of enemies.slice()) {
          for (let k = 0; k < 8; k++) particles.push(new Particle(enemy.rect.centerx, enemy.rect.centery, "rgb(255,100,100)"));
          killSprite(enemy);
          score += 1;
          stage_score += 1;
        }

        if (boss) {
          boss.hp -= 15;
          for (let k = 0; k < 30; k++) particles.push(new Particle(boss.rect.centerx, boss.rect.centery, "rgb(255,200,50)"));
          if (boss.hp <= 0) {
            boss = null;
            score += 10;
            se_clear.play();
            stage_clear = true;
            clear_time = performance.now();
            if (hell_mode_active && stage === 1) unlock_hell_stage1_clear();
          }
        }

        enemy_bullets.length = 0;
        boss_bullets.length = 0;
      }
    }
  }
}

// ============================================================
// メインステップ（pygame の while ループ 1 回分）
// ============================================================
function step() {
  const now = performance.now();
  processEvents();

  // --- メニュー画面 ---
  if (menu) {
    ctx.fillStyle = BLACK;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    drawText("haniwa bazooka 2", WIDTH / 2, HEIGHT / 2 - 120, 30, WHITE, "center");
    drawText("Press SPACE to Start", WIDTH / 2, HEIGHT / 2 - 60, 30, WHITE, "center");
    drawText("Press C to View How to Play", WIDTH / 2, HEIGHT / 2 - 20, 18, WHITE, "center");
    drawText(`Pilot: ${player_name} (Press N to change)`, WIDTH / 2, HEIGHT / 2 + 20, 18, "rgb(100,200,255)", "center");
    drawText(`Skin: ${get_skin_name(selected_skin)} (Press S to SELECT SKIN)`, WIDTH / 2, HEIGHT / 2 + 50, 18, "rgb(255,235,59)", "center");
    if (hard_mode_unlocked) drawText("* SPECIAL HARD MODE UNLOCKED *", WIDTH / 2, HEIGHT / 2 + 90, 30, RED, "center");
    else if (hell_mode_unlocked) drawText("* HELL MODE UNLOCKED *", WIDTH / 2, HEIGHT / 2 + 90, 30, RED, "center");
    if (hell_code_revealed) drawText("HELL CODE UNLOCKED: H - E - L - L", WIDTH / 2, HEIGHT / 2 + 130, 18, "rgb(0,230,118)", "center");
    return;
  }

  // --- チュートリアル画面 ---
  if (tutorial) {
    ctx.fillStyle = BLACK;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    drawText("- HOW TO PLAY -", WIDTH / 2, 40, 30, WHITE, "center");
    const lines = [
      "MOVE: Arrow Keys or WASD Keys (Up, Down, Left, Right)",
      "SLOW MOVE: Shift Key (Reveals Hitbox)",
      "SHOOT: Space Key (Fast Autoshot)",
      "BOMB (Emergency): X Key (Clears Screen & Bullets)",
      "",
      "ITEMS (GEMS):",
      "  * Green: Score Bonus (+5)",
      "  * Cyan: Temporary Speed Up",
      "  * Blue: Temporary Double Shot",
      "  * Purple: Temporary Triple Shot (3way)",
      "  * Orange: Temporary Power Boost (2x Damage) *BOSS ONLY*",
      "  * Yellow: Protective Shield Barrier",
      "  * Heart: Restore Life (Max up to 8)",
      "",
      "Press SPACE to Return to Menu",
    ];
    lines.forEach((line, i) => {
      let color = WHITE;
      if (line.includes("Green:")) color = "rgb(100,255,100)";
      else if (line.includes("Cyan:")) color = "rgb(100,200,255)";
      else if (line.includes("Blue:")) color = "rgb(100,100,255)";
      else if (line.includes("Purple:")) color = "rgb(180,100,255)";
      else if (line.includes("Orange:")) color = "rgb(255,120,0)";
      else if (line.includes("Yellow:")) color = "rgb(255,255,100)";
      else if (line.includes("Heart:")) color = "rgb(255,100,100)";
      else if (line.includes("Return")) color = "rgb(200,200,200)";
      drawText(line, 40, 100 + i * 32, 18, color, "left");
    });
    return;
  }

  // --- スキン選択画面（スクロール対応） ---
  if (skin_menu) {
    ctx.fillStyle = BLACK;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    drawText("- SELECT SKIN -", WIDTH / 2, 40, 30, WHITE, "center");

    const ROW_H = 45;
    const ROW_TOP = 110;
    const VISIBLE = 9; // 一度に表示する行数
    const total = playerSkins.length;

    // カーソルが常に見えるようにスクロール開始位置を決定
    let start = 0;
    if (total > VISIBLE) {
      start = cursor_skin - Math.floor(VISIBLE / 2);
      start = Math.max(0, Math.min(start, total - VISIBLE));
    }
    const end = Math.min(total, start + VISIBLE);

    for (let i = start; i < end; i++) {
      const row = i - start;
      const y = ROW_TOP + row * ROW_H;
      const unlocked = is_skin_unlocked(i);
      let color = WHITE;
      let name_str;
      if (i === cursor_skin) {
        color = unlocked ? "rgb(255,235,59)" : "rgb(255,100,100)";
        name_str = `> ${get_skin_name(i)}`;
      } else {
        color = unlocked ? "rgb(180,180,180)" : "rgb(60,60,60)";
        name_str = `  ${get_skin_name(i)}`;
      }
      drawText(name_str, 100, y, 18, color, "left");
      if (unlocked) {
        const d = getSkinDrawable(i);
        const r = new Rect(40, y - 10, 50, 40);
        if (d) ctx.drawImage(d, r.x, r.y, r.width, r.height);
        else { ctx.fillStyle = playerSkins[i].color; ctx.fillRect(r.x, r.y, r.width, r.height); }
      } else {
        drawText("?", 55, y - 10, 18, "rgb(100,100,100)", "left");
      }
    }

    // スクロールインジケータ（上下に続きがある場合）
    if (start > 0) drawText("▲ more", WIDTH / 2, ROW_TOP - 22, 16, "rgb(150,150,150)", "center");
    if (end < total) drawText("▼ more", WIDTH / 2, ROW_TOP + VISIBLE * ROW_H - 8, 16, "rgb(150,150,150)", "center");
    drawText(`${cursor_skin + 1} / ${total}`, WIDTH - 40, 40, 16, "rgb(150,150,150)", "center");

    drawText("UP/DOWN: Select Skin  |  SPACE: Confirm", WIDTH / 2, HEIGHT - 80, 18, WHITE, "center");
    drawText("Press ESC to Return to Menu", WIDTH / 2, HEIGHT - 50, 18, "rgb(200,200,200)", "center");
    return;
  }

  // --- ゲーム更新 ---
  if (!game_over && !stage_clear) {
    if (keys["Space"] && now - last_shot_time > shot_delay) {
      player.shoot();
      last_shot_time = now;
    }

    player.update();
    updateGroup(bullets);
    updateGroup(enemies);
    updateGroup(boss_bullets);
    updateGroup(enemy_bullets);
    updateGroup(items);

    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update();
      if (particles[i].lifetime <= 0) particles.splice(i, 1);
    }

    let max_enemies;
    if (hell_mode_active) max_enemies = Math.min(10 + (stage - 1), 15);
    else max_enemies = Math.min(6 + (stage - 1), 12);

    if (enemies.length < max_enemies && !boss_spawned) {
      addTo(enemies, new Enemy(choice([1, 1, 2, 2, 3, 4, 5, 6, 7, 8, 9])));
    }

    // 自機と敵・敵弾の衝突
    if (player.invincible_timer === 0) {
      const takeHit = () => {
        if (player.has_shield) {
          player.has_shield = false;
          for (let k = 0; k < 15; k++) particles.push(new Particle(player.rect.centerx, player.rect.centery, "rgb(100,200,255)"));
          play_shield_break_se();
          player.invincible_timer = 60;
        } else {
          lives -= 1;
          play_player_hit_se();
          player.invincible_timer = 60;
        }
      };
      if (playerCollide(enemies, true).length > 0) takeHit();
      if (player.invincible_timer === 0 && playerCollide(boss_bullets, true).length > 0) takeHit();
      if (player.invincible_timer === 0 && playerCollide(enemy_bullets, true).length > 0) takeHit();
    }

    // アイテム回収
    const collected = playerCollide(items, true);
    for (const item of collected) {
      if (item.item_type === "green") score += 5;
      else if (item.item_type === "cyan") player.speed_timer = 300;
      else if (item.item_type === "blue") player.power_timer = 300;
      else if (item.item_type === "purple") player.triple_timer = 300;
      else if (item.item_type === "orange") player.power_boost_timer = 600;
      else if (item.item_type === "yellow") player.has_shield = true;
      else if (item.item_type === "heart") {
        if (lives < 8) {
          lives += 1;
          se_hit.play();
        }
      }
    }
  }

  // 50 点以上で HELL コード解放
  if (!hell_code_revealed && score >= 50) {
    save_hell_revealed();
    se_clear.play();
  }

  // ゲームオーバー処理
  if (lives <= 0 && !game_over) {
    game_over = true;
    stopBgm();
    se_gameover.play();
    achievements.total_score += score;
    if (score > achievements.high_score) achievements.high_score = score;
    if (stage > achievements.max_stage) achievements.max_stage = stage;
    save_achievements(achievements);
    ranking = add_to_ranking(player_name, score, stage);
    // スコアを GAS へ送信後、少し待ってからリーダーボードを再取得
    send_score_to_gas(player_name, score, stage).then(() => {
      setTimeout(fetch_leaderboard, 1200);
    });
  }

  // 通常敵との弾の衝突
  for (const bullet of bullets.slice()) {
    if (!bullet.alive) continue;
    const hit_enemies = spritecollide(bullet, enemies, false, null);
    for (const enemy of hit_enemies) {
      killSprite(bullet);
      enemy.hp -= bullet.damage;
      se_hit.play();
      particles.push(new Particle(bullet.rect.centerx, bullet.rect.top, "rgb(255,255,100)"));

      if (enemy.hp <= 0) {
        for (let k = 0; k < 10; k++) particles.push(new Particle(enemy.rect.centerx, enemy.rect.centery, choice(["rgb(255,100,0)", "rgb(255,50,50)"])));

        if (enemy.type === 8) {
          const dx = player.rect.centerx - enemy.rect.centerx;
          const dy = player.rect.centery - enemy.rect.bottom;
          const dist = hypot(dx, dy);
          const speed_x = dist !== 0 ? (dx / dist) * 4.5 : 0;
          const speed_y = dist !== 0 ? (dy / dist) * 4.5 : 4.5;
          if (hell_mode_active) {
            addTo(enemy_bullets, new EnemyBullet(enemy.rect.centerx, enemy.rect.centery, speed_x, speed_y));
            addTo(enemy_bullets, new EnemyBullet(enemy.rect.centerx, enemy.rect.centery, speed_x - 1.0, speed_y - 0.5));
            addTo(enemy_bullets, new EnemyBullet(enemy.rect.centerx, enemy.rect.centery, speed_x + 1.0, speed_y - 0.5));
          } else {
            addTo(enemy_bullets, new EnemyBullet(enemy.rect.centerx, enemy.rect.centery, speed_x, speed_y));
          }
        }

        killSprite(enemy);
        score += 1;
        stage_score += 1;

        const drop_chance = enemy.type === 7 ? 0.6 : 0.25;
        if (rand() < drop_chance) {
          const item_type = choice(["green", "green", "green", "cyan", "blue", "yellow", "purple", "heart"]);
          addTo(items, new Item(enemy.rect.centerx, enemy.rect.centery, item_type));
        }
      }
      break; // 1 発の弾は 1 体のみにヒット
    }
  }

  // ボス出現
  const target_score = 15 + (stage - 1) * 5;
  if (!boss_spawned && stage_score >= target_score) {
    boss = new Boss();
    boss_spawned = true;
  }

  if (boss) {
    boss.update();
    for (const bullet of bullets.slice()) {
      if (!bullet.alive) continue;
      if (boss.rect.colliderect(bullet.rect)) {
        killSprite(bullet);
        boss.hp -= bullet.damage;
        particles.push(new Particle(bullet.rect.centerx, bullet.rect.top, "rgb(255,200,50)"));
        if (rand() < 0.08) {
          const item_type = choice(["green", "green", "green", "cyan", "blue", "yellow", "purple", "orange", "heart"]);
          addTo(items, new Item(bullet.rect.centerx, bullet.rect.centery, item_type));
        }
        if (boss.hp <= 0) {
          for (let k = 0; k < 45; k++) particles.push(new Particle(boss.rect.centerx, boss.rect.centery, choice(["rgb(255,220,0)", "rgb(255,120,50)"])));
          boss = null;
          score += 10;
          se_explosion.play();
          se_clear.play();
          stage_clear = true;
          clear_time = performance.now();
          if (hell_mode_active && stage === 1) unlock_hell_stage1_clear();
          break;
        }
      }
    }
  }

  // ============ 描画 ============
  // 背景スクロール
  bg_y += 2;
  if (bg_y >= HEIGHT) bg_y = 0;
  if (isDrawable(IMG.bg)) {
    ctx.drawImage(IMG.bg, 0, bg_y - HEIGHT, WIDTH, HEIGHT);
    ctx.drawImage(IMG.bg, 0, bg_y, WIDTH, HEIGHT);
  } else {
    ctx.fillStyle = "rgb(6,8,24)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  for (const it of items) it.draw();
  for (const b of bullets) b.draw();
  for (const e of enemies) e.draw();
  if (boss) {
    boss.draw();
    draw_boss_hp_bar(boss);
  }
  for (const b of enemy_bullets) b.draw();
  for (const b of boss_bullets) b.draw();
  for (const p of particles) p.draw();

  // プレイヤー（無敵時は点滅）
  if (!game_over) {
    if (player.invincible_timer === 0 || Math.trunc(player.invincible_timer / 4) % 2 === 0) {
      player.draw();
    }
  }

  // シールド
  if (!game_over && player.has_shield) {
    const cx = player.rect.centerx;
    const cy = player.rect.centery;
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(100,200,255,0.176)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(100,200,255,0.588)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Hitbox コア
  if (!game_over) {
    const [cx, cy] = player.rect.center;
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, 2 * Math.PI);
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
    ctx.fillStyle = RED;
    ctx.fill();
  }

  // ボム衝撃波
  if (bomb_active_timer > 0) {
    bomb_active_timer -= 1;
    const wave_radius = Math.trunc((45 - bomb_active_timer) * 20.0 + 35);
    const alpha = Math.max(0, Math.trunc(bomb_active_timer * 5.5)) / 255;
    ctx.beginPath();
    ctx.arc(player.rect.centerx, player.rect.centery, wave_radius, 0, 2 * Math.PI);
    ctx.strokeStyle = `rgba(100,220,255,${alpha})`;
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  // HUD
  drawText(`Score: ${score}`, 10, 10, 30, WHITE, "left");
  drawText(`Stage: ${stage}`, 10, 45, 30, WHITE, "left");
  if (hell_mode_active) drawText("[ HELL MODE ]", 10, 80, 30, RED, "left");

  draw_lives(WIDTH - 10, 10, lives, IMG.heart);
  draw_bombs(WIDTH - 10, 42, bomb_stock, IMG.gem_blue);

  if (game_over) {
    drawText("GAME OVER", WIDTH / 2 - 100, HEIGHT / 2 - 20, 30, RED, "left");
    drawText("Press SPACE to Restart", WIDTH / 2 - 170, HEIGHT / 2 + 20, 30, WHITE, "left");
    if (score >= 50 || hell_code_revealed) {
      drawText("HELL MODE UNLOCKED! CODE: H - E - L - L", WIDTH / 2, HEIGHT / 2 + 70, 18, "rgb(0,230,118)", "center");
    }
  }

  if (stage_clear) {
    drawText(`STAGE ${stage} CLEAR!`, WIDTH / 2 - 110, HEIGHT / 2 - 20, 30, WHITE, "left");
    drawText(`Next: STAGE ${stage + 1}`, WIDTH / 2 - 90, HEIGHT / 2 + 20, 30, WHITE, "left");
    if (performance.now() - clear_time > 3000) {
      stage_clear = false;
      stage += 1;
      stage_score = 0;
      boss_spawned = false;
      enemies.length = 0;
      bullets.length = 0;
      boss_bullets.length = 0;
      enemy_bullets.length = 0;
      items.length = 0;
      particles.length = 0;
      if (lives < 8) lives += 1;
      if (bomb_stock < 3) bomb_stock += 1;
    }
  }
}

// ============================================================
// 起動
// ============================================================
achievements = load_achievements();
selected_skin = load_selected_skin();
player_uuid = load_or_create_uuid();
player_name = get_saved_player_name();
hell_code_revealed = load_hell_revealed();
hell_stage1_clear = load_hell_stage1_clear();
player_rank = load_rank();
ranking = load_ranking();
update_rank_status(ranking);
fetch_leaderboard();
cursor_skin = selected_skin;

start_game();

// 固定タイムステップ 60FPS ループ（pygame clock.tick(60) 相当）
const STEP_MS = 1000 / 60;
let lastTime = performance.now();
let acc = 0;
function loop(t) {
  acc += t - lastTime;
  lastTime = t;
  let n = 0;
  while (acc >= STEP_MS && n < 5) {
    step();
    acc -= STEP_MS;
    n++;
  }
  if (n === 0) {
    // フレーム落ち防止：最低 1 回描画
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
