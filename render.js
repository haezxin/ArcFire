// ══════════════════════════════════════════════════════════════════════════════
//  ArcFire — render.js
//  All drawing and HUD code.  Sections:
//    1. Primitive helpers
//    2. Background & terrain
//    3. Obstacles (draw + formation builder)
//    4. Tanks
//    5. Projectiles & aim guide
//    6. Effects (explosions, smoke, burn zones, oil, craters)
//    7. Power-ups
//    8. HUD (health bars, center stats, ammo hotbar, wind overlay, hint)
//    9. Title / combo / misc overlays
//   10. Master render() entry-point
// ══════════════════════════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────────────────────────
// 1. PRIMITIVE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Draws a rounded rectangle path and optionally fills / strokes it.
 */
function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    const radius = Math.min(Math.abs(w), Math.abs(h), r);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill)   ctx.fill();
    if (stroke) ctx.stroke();
}

function drawPanelText(x, y, text, color, size = 16) {
    ctx.fillStyle = color;
    ctx.font = `${size >= 16 ? "700" : "500"} ${size}px Arial`;
    ctx.fillText(text, x, y);
}

function drawCloud(x, y, w, h) {
    ctx.beginPath();
    ctx.arc(x,              y,           h * 0.42, 0, Math.PI * 2);
    ctx.arc(x + w * 0.22,   y - h * 0.16, h * 0.50, 0, Math.PI * 2);
    ctx.arc(x + w * 0.48,   y - h * 0.10, h * 0.58, 0, Math.PI * 2);
    ctx.arc(x + w * 0.72,   y,           h * 0.46, 0, Math.PI * 2);
    ctx.fill();
}

function drawBush(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#356f2d";
    ctx.beginPath();
    ctx.arc(-8,  0, 10, 0, Math.PI * 2);
    ctx.arc( 2, -6, 12, 0, Math.PI * 2);
    ctx.arc(12,  1,  9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawRock(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#7d7f85";
    ctx.beginPath();
    ctx.moveTo(-18,  10);
    ctx.lineTo(-10, -10);
    ctx.lineTo(  8, -16);
    ctx.lineTo( 22,  -4);
    ctx.lineTo( 18,  12);
    ctx.lineTo(  0,  18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.stroke();
    ctx.restore();
}

function drawGauge(cx, cy, radius, angleValue, min, max, color) {
    ctx.save();
    ctx.translate(cx, cy);

    ctx.strokeStyle = "rgba(10,18,26,0.85)";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(0, 0, radius, Math.PI, 0);
    ctx.stroke();

    const percent = clamp((angleValue - min) / (max - min), 0, 1);
    ctx.strokeStyle = color;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(0, 0, radius, Math.PI, Math.PI + Math.PI * percent);
    ctx.stroke();

    const needleAngle = Math.PI + Math.PI * percent;
    ctx.strokeStyle = "#f3f8ff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(needleAngle) * (radius - 8), Math.sin(needleAngle) * (radius - 8));
    ctx.stroke();

    ctx.fillStyle = "rgba(10,18,26,0.9)";
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}


// ─────────────────────────────────────────────────────────────────────────────
// 2. BACKGROUND & TERRAIN
// ─────────────────────────────────────────────────────────────────────────────

function drawBackground() {
    if (GAME.bgCanvas) {
        ctx.drawImage(GAME.bgCanvas, 0, 0);
    } else {
        const grad = ctx.createLinearGradient(0, 0, 0, GAME.height);
        grad.addColorStop(0, "#2c3b4a");
        grad.addColorStop(1, "#12181f");
        ctx.imageSmoothingEnabled  = true;
        ctx.imageSmoothingQuality  = "high";
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, GAME.width, GAME.height);
    }

    ctx.fillStyle = "rgba(255,255,255,0.18)";
    GAME.clouds.forEach(c => drawCloud(c.x, c.y, c.w, c.h));
}

function drawTerrain() {
    if (GAME.terrainCanvas) ctx.drawImage(GAME.terrainCanvas, 0, 0);
}

function drawCraters() {
    for (const c of GAME.craters) {
        const img = IMAGES[c.key];
        if (!img || !img.complete || !img.naturalWidth) continue;
        ctx.save();
        ctx.globalAlpha = 0.82;
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rotation);
        ctx.drawImage(img, -c.r, -c.r * 0.5, c.r * 2, c.r);
        ctx.restore();
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// 3. OBSTACLES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * createObstacleFormation — builds a stacked grid or pyramid of obstacles.
 *
 * @param {object} opts
 * @param {number}          opts.baseX      Center X of the formation.
 * @param {number}         [opts.baseY]     Explicit Y for the bottom row; omit to sit on terrain.
 * @param {number}          opts.cols       Columns in the bottom row.
 * @param {number}          opts.rows       Number of rows (for pyramid: rows <= cols).
 * @param {number}          opts.obsWidth   Pixel width of each obstacle.
 * @param {number}          opts.obsHeight  Pixel height of each obstacle.
 * @param {string}         [opts.type]      Obstacle type string (default "bunker").
 * @param {string}         [opts.imgKey]    Optional image key for every cell.
 * @param {number}         [opts.hp]        Hit-points per obstacle (default 100).
 * @param {string}         [opts.idPrefix]  Unique prefix to avoid ID collisions.
 * @param {"grid"|"pyramid"} [opts.mode]   "grid" keeps cols fixed; "pyramid" removes 1 per row.
 *
 * @returns {object[]}  Array of obstacle objects ready to push into GAME.obstacles.
 *
 * Usage examples
 * ──────────────
 *   // 3×3 flat grid centred at x=500
 *   GAME.obstacles.push(...createObstacleFormation({
 *       baseX: 500, cols: 3, rows: 3,
 *       obsWidth: 48, obsHeight: 48,
 *       idPrefix: "grid1", mode: "grid"
 *   }));
 *
 *   // Classic 3-wide pyramid (3→2→1)
 *   GAME.obstacles.push(...createObstacleFormation({
 *       baseX: 800, cols: 3, rows: 3,
 *       obsWidth: 48, obsHeight: 48,
 *       idPrefix: "pyr1", mode: "pyramid"
 *   }));
 */
function createObstacleFormation({
    baseX,
    baseY    = undefined,
    cols,
    rows,
    obsWidth,
    obsHeight,
    type      = "bunker",
    imgKey    = null,
    hp        = 100,
    idPrefix  = "obs",
    mode      = "grid"
}) {
    const obstacles = [];
    // grid[row] stores the id of each cell so children can reference parents.
    const grid = [];

    for (let row = 0; row < rows; row++) {
        grid[row] = [];

        const colsInRow = (mode === "pyramid") ? (cols - row) : cols;
        if (colsInRow <= 0) break;                          // pyramid apex reached

        // Centre this row around baseX
        const rowWidth = (colsInRow - 1) * obsWidth;
        const startX   = baseX - rowWidth / 2;

        for (let col = 0; col < colsInRow; col++) {
            const id  = `${idPrefix}_r${row}_c${col}`;
            const obs = {
                id,
                x:      startX + col * obsWidth,
                width:  obsWidth,
                height: obsHeight,
                type,
                imgKey,
                alive:  true,
                hp,
                maxHp:  hp,
            };

            if (row === 0) {
                // ── Bottom row: either explicit Y or terrain placement (Case C)
                if (baseY !== undefined) obs.y = baseY;
                // No `y` → drawObstacles Case C places it on the terrain automatically.
            } else {
                // ── Upper rows: stack on the obstacle directly below.
                // In pyramid mode col N of row R maps to col N of row R-1.
                // Fall back to col N-1 if this row is narrower than expected.
                const parentId = grid[row - 1][col] ?? grid[row - 1][col - 1];
                obs.stackedOn  = parentId;
            }

            grid[row].push(id);
            obstacles.push(obs);
        }
    }

    return obstacles;
}

/**
 * Draws all live obstacles.
 * Handles three placement cases per obstacle:
 *   A) Explicit obs.y          — manual / absolute placement
 *   B) obs.stackedOn parent id — stacked on another obstacle
 *   C) Default                 — resting on terrain
 */
function drawObstacles() {
    // ── 1. Build ID look-up map ──────────────────────────────────────────────
    const obstacleMap = {};
    GAME.obstacles.forEach(o => { if (o.id) obstacleMap[o.id] = o; });

    // ── 2. Resolve Y, angle, and stacking depth for every live obstacle ──────
    // We'll compute positions iteratively to guarantee parents are resolved
    // before children. This avoids subtle recursion ordering issues.
    const renderList = [];
    GAME.obstacles.forEach(obs => {
        if (!obs.alive) return;
        renderList.push({ ...obs, renderY: (obs.y !== undefined ? obs.y : null), renderAngle: (obs.angle || 0), renderDepth: (obs.y !== undefined ? 0 : null) });
    });

    // Map by id for quick lookup
    const renderMap = {};
    renderList.forEach(r => { if (r.id) renderMap[r.id] = r; });

    // First: assign terrain Y for any obstacle that has no stackedOn and no explicit y
    renderList.forEach(r => {
        if (r.renderY === null && !r.stackedOn) {
            r.renderY = getTerrainY(r.x);
            r.renderDepth = 0;
            r.renderAngle = getTerrainAngle(r.x);
        }
    });

    // Iteratively resolve stacked obstacles: allow up to N passes
    const pending = renderList.filter(r => r.renderY === null && r.stackedOn);
    const maxPasses = Math.max(8, pending.length * 3);
    for (let pass = 0; pass < maxPasses; pass++) {
        let progressed = false;
        for (let i = pending.length - 1; i >= 0; i--) {
            const r = pending[i];
            let parent = null;
            if (r.parentRef && renderMap[r.parentRef.id]) parent = renderMap[r.parentRef.id];
            else if (r.stackedOn && renderMap[r.stackedOn]) parent = renderMap[r.stackedOn];
            if (parent && parent.renderY !== null) {
                r.renderY = parent.renderY - (parent.height || r.height) + (r.offsetY || 0);
                r.renderAngle = parent.renderAngle || 0;
                r.renderDepth = (parent.renderDepth || 0) + 1;
                pending.splice(i, 1);
                progressed = true;
            }
        }
        if (!progressed) break;
    }

    // Remaining unresolved (circular or missing parent): place on terrain
    pending.forEach(r => {
        r.renderY = getTerrainY(r.x);
        r.renderAngle = getTerrainAngle(r.x);
        r.renderDepth = 0;
    });

    // Final alignment pass: force children to sit exactly on parent top
    renderList.forEach(r => {
        let parent = null;
        if (r.parentRef && renderMap[r.parentRef.id]) parent = renderMap[r.parentRef.id];
        else if (r.stackedOn && renderMap[r.stackedOn]) parent = renderMap[r.stackedOn];
        if (parent) {
            const expected = parent.renderY - (parent.height || r.height) + (r.offsetY || 0);
            // If difference > 1px, snap to expected to avoid gaps
            if (Math.abs((r.renderY || 0) - expected) > 1) {
                r.renderY = expected;
                r.renderAngle = parent.renderAngle || r.renderAngle;
                r.renderDepth = (parent.renderDepth || 0) + 1;
            }
        }
    });

    // ── 3. Sort: draw lower (base) obstacles first, then higher (stacked) ones ──
    // Higher renderY values are visually lower on screen, so sort descending
    renderList.sort((a, b) => {
        const dy = b.renderY - a.renderY;
        if (dy !== 0) return dy;
        // If Y equal, draw parent (smaller depth) before child
        return a.renderDepth - b.renderDepth;
    });

    // ── 4. Draw ──────────────────────────────────────────────────────────────

    // Debug logging removed — rendering checks complete

    renderList.forEach(obs => {
        ctx.save();
        ctx.translate(obs.x, obs.renderY);
        // Remove rotation for plain 2D stacking
        // ctx.rotate(obs.renderAngle);

        // Try image first
        let drawn = false;
        if (obs.type === "image" && obs.imgKey) {
            const img = IMAGES[obs.imgKey];
            if (img && img.complete && (img.width > 0 || img.naturalWidth > 0)) {
                ctx.globalCompositeOperation = "source-over";
                ctx.drawImage(img, -obs.width / 2, -obs.height, obs.width, obs.height);
                drawn = true;
            }
        }

        // Fallback shapes
        if (!drawn) {
            if (obs.type === "bunker") {
                _drawBunkerShape(obs);
            } else {
                drawRock(0, -obs.height / 2, obs.width / 30);
            }
        }

        // Health bar
        if (obs.hp !== undefined) {
            ctx.globalCompositeOperation = "source-over";
            // Background track
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.fillRect(-obs.width / 2, -obs.height - 14, obs.width, 5);
            // Fill
            ctx.fillStyle = "#7aff7a";
            ctx.fillRect(
                -obs.width / 2, -obs.height - 14,
                Math.max(0, obs.width * (obs.hp / obs.maxHp)), 5
            );
        }

        // Damage smoke
        if (obs.hp !== undefined && obs.hp < obs.maxHp) {
            const smokeRadius = (1 - obs.hp / obs.maxHp) * Math.max(obs.width, obs.height) * 0.4;
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.beginPath();
            ctx.arc(0, -obs.height / 2, smokeRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    });

    // Debug overlay removed — visual checks complete
}

/** Internal helper — draws the bunker polygon (called from drawObstacles). */
function _drawBunkerShape(obs) {
    ctx.fillStyle = "#5a5c62";
    ctx.beginPath();
    ctx.moveTo(-obs.width / 2, 0);
    ctx.lineTo(-obs.width / 2, -obs.height + 14);
    ctx.quadraticCurveTo(0, -obs.height - 10, obs.width / 2, -obs.height + 14);
    ctx.lineTo(obs.width / 2, 0);
    ctx.fill();

    ctx.lineWidth    = 3;
    ctx.strokeStyle  = "#38393d";
    ctx.stroke();

    // Slit window
    ctx.fillStyle = "#111";
    ctx.fillRect(-obs.width / 4, -obs.height / 1.5, obs.width / 2, 8);
}


// ─────────────────────────────────────────────────────────────────────────────
// 4. TANKS
// ─────────────────────────────────────────────────────────────────────────────

function drawTank(tank) {
    if (!tank.alive && tank.state === "exploding") return;

    const x      = tank.x;
    const y      = tank.y;
    const angle  = tank.state === "parachuting" ? 0 : getTerrainAngle(x);
    const prefix = tank.color === "green" ? "blue" : "red";
    const dir    = tank.facing === 1 ? "right" : "left";
    const flash  = tank.hitFlash > 0 ? 0.45 : 0;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(x, y + (tank.state === "parachuting" ? 0 : Math.sin(tank.bob) * 0.6));
    ctx.rotate(angle);
    ctx.scale(tank.scale, tank.scale);

    const state = (!tank.alive && tank.state !== "exploding") ? "exploding" : tank.state;

    if (state === "parachuting") {
        _drawTankParachuting(tank, prefix, dir);
    } else if (tank.isCustom) {
        _drawTankCustom(tank, angle);
    } else {
        _drawTankSprite(tank, prefix, dir, state);
    }

    // Hit flash overlay
    if (flash > 0) {
        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = `rgba(255,255,255,${flash})`;
        ctx.fillRect(-80, -80, 160, 160);
    }

    ctx.restore();

    // Stuck shadow (mud / quicksand indicator)
    if (tank.stuckTurns > 0) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.beginPath();
        ctx.ellipse(0, 5, 45 * tank.scale, 10 * tank.scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Burn-zone glow beneath tank
    if (GAME.burnZones && GAME.burnZones.length > 0) {
        const isBurning = GAME.burnZones.some(
            z => z.turnsLeft > 0 && Math.abs(tank.x - z.x) <= z.radius
        );
        if (isBurning) _drawTankBurnGlow(tank, x, y, angle);
    }
}

function _drawTankParachuting(tank, prefix, dir) {
    const key = tank.color === "green" ? "tankBlueParachute" : "tankRedParachute";
    const img = IMAGES[key];
    if (img && img.complete && img.width > 0) {
        ctx.drawImage(img, -48, -71, 96, 96);
    } else {
        const para = IMAGES["parachute"];
        if (para && para.complete && para.width > 0) ctx.drawImage(para, -32, -135, 64, 64);
        const tankImg = IMAGES[`${prefix}_idle_${dir}`];
        if (tankImg && tankImg.complete && tankImg.width > 0)
            ctx.drawImage(tankImg, -48, -71, 96, 96);
    }
}

function _drawTankCustom(tank, terrainAngle) {
    const parts = tank.customParts;

    // 1. Tracks (bottom layer)
    const tracksImg = IMAGES[parts.tracks];
    if (tracksImg && tracksImg.complete) {
        ctx.drawImage(tracksImg, -tracksImg.width / 2, -tracksImg.height / 2 - 5);
    }

    // 2. Turret (behind hull)
    const turretImg = IMAGES[parts.turret];
    if (turretImg && turretImg.complete) {
        ctx.save();
        ctx.translate(0, -23);
        const aimAngle = (tank.angle - terrainAngle * 180 / Math.PI) * Math.PI / 180;
        ctx.rotate(aimAngle);
        ctx.drawImage(turretImg, 0, -turretImg.height / 2);
        ctx.restore();
    }

    // 3. Hull (top layer)
    const bodyImg = IMAGES[parts.body];
    if (bodyImg && bodyImg.complete) {
        ctx.drawImage(bodyImg, -bodyImg.width / 2, -bodyImg.height / 2 - 14);
    }
}

function _drawTankSprite(tank, prefix, dir, state) {
    let key;
    if      (state === "idle")      key = `${prefix}_idle_${dir}`;
    else if (state === "moving")    key = `${prefix}_move_${dir}`;
    else if (state === "firing")    key = `${prefix}_fire_${dir}`;
    else if (state === "exploding") key = `${prefix}_explode_${dir}`;
    else                            key = `${prefix}_idle_${dir}`;

    const img = IMAGES[key];
    if (img && img.complete && img.width > 0) {
        if (state === "idle") {
            ctx.drawImage(img, -48, -71, 96, 96);
        } else {
            const cols        = Math.floor(img.width  / 64) || 1;
            const rows        = Math.floor(img.height / 64) || 1;
            const totalFrames = cols * rows;
            let   frame       = tank.animFrame % totalFrames;

            if (state === "exploding" && frame >= totalFrames - 1) frame = totalFrames - 1;
            if (state === "firing"    && frame >= totalFrames - 1) frame = totalFrames - 1;

            ctx.drawImage(img,
                (frame % cols) * 64, Math.floor(frame / cols) * 64, 64, 64,
                -48, -71, 96, 96
            );
        }
    } else {
        ctx.fillStyle = tank.color;
        ctx.fillRect(-36, -30, 72, 30);
    }
}

function _drawTankBurnGlow(tank, x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.55;
    const glow = ctx.createRadialGradient(0, 5, 4, 0, 5, 55 * tank.scale);
    glow.addColorStop(0,    "rgba(255, 200,  80, 0.55)");
    glow.addColorStop(0.25, "rgba(255, 120,  30, 0.25)");
    glow.addColorStop(1,    "rgba(180,  20,  20, 0.00)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(0, 8, 48 * tank.scale, 14 * tank.scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}


// ─────────────────────────────────────────────────────────────────────────────
// 5. PROJECTILES & AIM GUIDE
// ─────────────────────────────────────────────────────────────────────────────

function drawAimGuide() {
    if (GAME.state !== "aiming" || GAME.winner) return;
    if (GAME.mode !== "multiplayer" && GAME.turn !== "player") return;

    const activeTank = GAME.turn === "player" ? player : enemy;
    const muzzle     = activeTank.muzzlePoint();
    const rad        = activeTank.angle * Math.PI / 180;

    let x  = muzzle.x, y  = muzzle.y;
    let vx = Math.cos(rad) * activeTank.power * 0.165;
    let vy = Math.sin(rad) * activeTank.power * 0.165;

    const baseSteps  = 16;
    const extraSteps = 12;
    const steps      = baseSteps +
        (activeTank === player ? (GAME.playerUpgrades.pointer * extraSteps) : 0);

    const preview = [];
    for (let i = 0; i < steps; i++) {
        x += vx; y += vy; vy += GAME.gravity; vx += GAME.wind * 1.15;
        x += vx; y += vy; vy += GAME.gravity; vx += GAME.wind * 1.15;
        preview.push({ x, y });
        if (y > getTerrainY(x)) break;
    }

    const highlightAt = Math.floor(steps * 0.7);
    ctx.save();
    for (let i = 0; i < preview.length; i++) {
        const p = preview[i];
        ctx.globalAlpha = 1 - i / preview.length;
        ctx.fillStyle   = (activeTank === player && i > highlightAt) ? "#ffd54f" : "#ffffff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.4 - i * (2.4 / preview.length), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function drawProjectile() {
    if (!GAME.projectiles || GAME.projectiles.length === 0) return;

    for (const p of GAME.projectiles) {
        ctx.save();

        // Trail line
        if (p.trail.length > 1) {
            ctx.beginPath();
            p.trail.forEach((t, i) => i === 0 ? ctx.moveTo(t.x, t.y) : ctx.lineTo(t.x, t.y));
            ctx.strokeStyle = p.fireTrail ? "rgba(255,150,40,0.92)" : "rgba(234,239,255,0.85)";
            ctx.lineWidth   = p.fireTrail ? 3 : 2;
            ctx.globalAlpha = p.fireTrail ? 0.75 : 0.55;
            ctx.stroke();
        }

        // Trail particles
        for (const t of p.trail) {
            ctx.globalAlpha = t.life * 0.7;
            ctx.fillStyle   = p.fireTrail
                ? "rgba(255,180,60,0.96)"
                : "rgba(248,248,255,0.97)";
            ctx.beginPath();
            ctx.arc(t.x, t.y, (p.fireTrail ? 5.2 : 4.0) * t.life, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // Projectile body
        ctx.save();
        ctx.translate(p.x, p.y);

        // Napalm / fire-trail glow
        if (p.fireTrail) {
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = 0.28;
            const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 18);
            glow.addColorStop(0,   "rgba(255,220,130,0.90)");
            glow.addColorStop(0.4, "rgba(255,140, 55,0.55)");
            glow.addColorStop(1,   "rgba(255,110, 30,0.00)");
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(0, 0, 18, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        ctx.rotate(Math.atan2(p.vy, p.vx));

        if (p.homing) {
            const frame = Math.floor(p.animTimer) % 2 === 0 ? "missile1" : "missile2";
            const img   = IMAGES[frame];
            if (img) {
                ctx.drawImage(img, -24, -12, 48, 24);
            } else {
                ctx.fillStyle = "#ff4444";
                ctx.fillRect(-12, -4, 24, 8);
            }
        } else if (p.type === "Oil") {
            // Tumbling barrel
            ctx.scale(1.2, 1.2);
            ctx.rotate(GAME.time * 8);
            ctx.fillStyle = "#333";
            roundRect(ctx, -8, -10, 16, 20, 4, true, false);
            ctx.fillStyle = "#444";
            ctx.fillRect(-8, -6, 16, 2);
            ctx.fillRect(-8,  4, 16, 2);
            ctx.fillStyle = "#f1c40f";
            ctx.fillRect(-4, -2,  8, 4);
        } else {
            // Standard shell
            const s = p.radius / 5;
            ctx.scale(s, s);
            ctx.fillStyle = "#6b7179";
            roundRect(ctx, -8, -4, 16, 8, 3, true, false);
            ctx.fillStyle = "#c7ccd3";
            roundRect(ctx,  2, -3,  6, 6, 2, true, false);
        }

        ctx.restore();
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// 6. EFFECTS
// ─────────────────────────────────────────────────────────────────────────────

function drawEffects() {
    for (const effect of GAME.effects) {
        const progress = 1 - effect.timer / effect.max;

        if (effect.type === "muzzle")        _drawMuzzleFlash(effect, progress);
        if (effect.type === "explosion")     _drawExplosion(effect, progress);
        if (effect.type === "bigExplosion")  _drawBigExplosion(effect, progress);
        if (effect.type === "smoke")         _drawSmoke(effect, progress);
        if (effect.type === "dirtSplash")    _drawDirtSplash(effect);
        if (effect.type === "oilPuddle")     drawOilPuddle(effect);
    }

    // Flying debris chunks
    GAME.debris.forEach(d => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, d.life);
        ctx.fillStyle   = "#6d5233";
        ctx.fillRect(d.x, d.y, d.size, d.size);
        ctx.restore();
    });
}

function _drawMuzzleFlash(effect, progress) {
    ctx.save();
    ctx.translate(effect.x, effect.y);
    ctx.rotate(effect.angle);
    ctx.globalAlpha = 1 - progress;
    const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, 34);
    grad.addColorStop(0,    "rgba(255,255,255,1.00)");
    grad.addColorStop(0.35, "rgba(255,235,140,0.95)");
    grad.addColorStop(1,    "rgba(255,120, 30,0.00)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo( 0,   0);
    ctx.lineTo(34, -11);
    ctx.lineTo(24,   0);
    ctx.lineTo(34,  11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function _drawExplosion(effect, progress) {
    const r = effect.radius * (0.25 + progress);
    ctx.save();
    ctx.globalAlpha = 1 - progress * 0.9;
    const grad = ctx.createRadialGradient(effect.x, effect.y, 2, effect.x, effect.y, r);
    grad.addColorStop(0,    "rgba(255,255,240,1.00)");
    grad.addColorStop(0.22, "rgba(255,223,110,0.95)");
    grad.addColorStop(0.60, "rgba(255,130, 40,0.82)");
    grad.addColorStop(1,    "rgba(110, 30, 20,0.00)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function _drawBigExplosion(effect, progress) {
    const frame  = Math.floor(progress * 11) + 1;
    const img    = IMAGES[`explosion_${frame}`];
    if (!img) return;
    ctx.save();
    ctx.globalAlpha = 1 - progress * 0.8;
    const w = img.naturalWidth  * 1.2;
    const h = img.naturalHeight * 1.2;
    ctx.drawImage(img, effect.x - w / 2, effect.y - h / 2, w, h);
    ctx.restore();
}

function _drawSmoke(effect, progress) {
    ctx.save();
    ctx.globalAlpha = 0.5 * (1 - progress);
    for (let i = 0; i < 5; i++) {
        ctx.fillStyle = "rgba(80,80,80,0.7)";
        ctx.beginPath();
        ctx.arc(
            effect.x + Math.sin(i * 1.3) * 18 * progress,
            effect.y - 15 * progress - i * 6,
            effect.radius * 0.18 + i * 3,
            0, Math.PI * 2
        );
        ctx.fill();
    }
    ctx.restore();
}

function _drawDirtSplash(effect) {
    const splash = Math.max(0, 1 - effect.timer / effect.max);
    const radius = effect.radius * splash;
    ctx.save();
    ctx.globalAlpha = 0.8 * (1 - splash);
    ctx.fillStyle   = "rgba(120,92,46,0.95)";
    for (let i = 0; i < 14; i++) {
        const angle    = (i / 14) * Math.PI * 2 + (effect.seed || 0);
        const distance = radius * (0.35 + Math.random() * 0.7);
        ctx.beginPath();
        ctx.arc(
            effect.x + Math.cos(angle) * distance,
            effect.y + Math.sin(angle) * distance * 0.4,
            (2 + Math.random() * 3) * (1 - splash),
            0, Math.PI * 2
        );
        ctx.fill();
    }
    ctx.restore();
}

function drawOilPuddle(e) {
    ctx.save();
    ctx.globalAlpha = Math.min(1.0, e.timer * 1.5);
    ctx.translate(e.x, e.y);
    // Dark base
    ctx.fillStyle = "rgba(10,10,10,0.85)";
    ctx.beginPath();
    ctx.ellipse(0, 5, e.radius, e.radius * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Iridescent sheen
    ctx.strokeStyle = "rgba(60,60,80,0.4)";
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.ellipse(0, 5, e.radius * 0.8, e.radius * 0.2, 0.1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

function drawBurnZones() {
    if (!GAME.burnZones || GAME.burnZones.length === 0) return;

    for (const z of GAME.burnZones) {
        const intensity = z.turnsLeft / 2;
        const flicker   = 0.85 + Math.sin(GAME.titleTimer * 11 + z.x * 0.01) * 0.2;
        const alpha     = Math.max(0, Math.min(1, intensity)) * 0.78 * flicker;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(z.x, z.y);
        ctx.globalCompositeOperation = "lighter";

        // Core glow
        const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, z.radius);
        grad.addColorStop(0,    "rgba(255,210, 90,0.70)");
        grad.addColorStop(0.25, "rgba(255,120, 30,0.45)");
        grad.addColorStop(0.70, "rgba(210, 50, 20,0.22)");
        grad.addColorStop(1,    "rgba( 90, 10, 10,0.00)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, 5, z.radius * 1.05, z.radius * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();

        // Flame tips
        for (let i = 0; i < 11; i++) {
            const t   = i / 11;
            const ang = t * Math.PI * 2 + (GAME.titleTimer * 0.95);
            const rx  = Math.cos(ang) * z.radius * 0.58;
            const ry  = 5 + Math.sin(ang) * z.radius * 0.22;
            ctx.strokeStyle = "rgba(255,90,20,0.5)";
            ctx.lineWidth   = 2.25;
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx, ry - 14 - Math.random() * 18);
            ctx.stroke();
        }

        // Ember specks
        for (let i = 0; i < 10; i++) {
            const ang = Math.random() * Math.PI * 2;
            const r   = z.radius * Math.random() * 0.85;
            ctx.fillStyle = "rgba(255,170,60,0.35)";
            ctx.beginPath();
            ctx.arc(
                Math.cos(ang) * r,
                3 + (Math.random() - 0.5) * 6,
                1.5 + Math.random() * 2.2,
                0, Math.PI * 2
            );
            ctx.fill();
        }

        ctx.restore();
    }
}

/**
 * Advances all effect timers and cleans up expired ones.
 * Also advances tank animation states and global timers.
 * Called from update() in game.js.
 */
function updateEffects(dt) {
    GAME.effects.forEach(e => e.timer -= dt);
    GAME.effects = GAME.effects.filter(e => e.timer > 0);

    GAME.debris.forEach(d => {
        d.x  += d.vx;
        d.y  += d.vy;
        d.vy += 0.12;
        d.life -= dt;
    });
    GAME.debris = GAME.debris.filter(d => d.life > 0 && d.y < GAME.height + 30);

    if (GAME.comboPopup) {
        GAME.comboPopup.timer -= dt;
        GAME.comboPopup.scale += dt * 0.35;
        if (GAME.comboPopup.timer <= 0) GAME.comboPopup = null;
    }

    [player, enemy].forEach(tank => {
        tank.hitFlash = Math.max(0, tank.hitFlash - dt);

        const prefix = tank.color === "green" ? "blue" : "red";
        const dir    = tank.facing === 1 ? "right" : "left";

        if (tank.state === "moving" && tank.alive) {
            tank.animTimer += dt * 10;
            if (tank.animTimer > 1) { tank.animTimer = 0; tank.animFrame++; }

        } else if (tank.state === "firing") {
            tank.animTimer += dt * 15;
            if (tank.animTimer > 1) {
                tank.animTimer = 0;
                tank.animFrame++;
                const img    = IMAGES[`${prefix}_fire_${dir}`];
                const frames = img ? Math.floor(img.width / 64) * Math.floor(img.height / 64) : 12;
                if (tank.animFrame >= Math.max(1, frames)) tank.state = "idle";
            }

        } else if (tank.state === "exploding") {
            tank.animTimer += dt * 10;
            if (tank.animTimer > 1) {
                tank.animTimer = 0;
                tank.animFrame++;
                const img    = IMAGES[`${prefix}_explode_${dir}`];
                const frames = Math.max(1, img ? Math.floor(img.width / 64) * Math.floor(img.height / 64) : 12);
                if (tank.animFrame >= frames - 1) tank.animFrame = frames - 1;
            }
        }
    });

    GAME.flashTimer  = Math.max(0, GAME.flashTimer  - dt);
    GAME.screenShake = Math.max(0, GAME.screenShake - dt * 20);
    GAME.titleTimer += dt;
}


// ─────────────────────────────────────────────────────────────────────────────
// 7. POWER-UPS
// ─────────────────────────────────────────────────────────────────────────────

function updatePowerUps(dt) {
    GAME.powerUps.forEach(pu => {
        if (pu.pickedUp) return;
        pu.bob += dt * 2;
        pu.y    = getTerrainY(pu.x);

        const pickupDist = 68;
        [player, enemy].forEach(tank => {
            const opponent    = tank === player ? enemy : player;
            const tankCenterY = tank.y - 24 * tank.scale;
            const puCenterY   = pu.y  - 45;
            if (Math.hypot(tank.x - pu.x, tankCenterY - puCenterY) >= pickupDist) return;
            if (pu.pickedUp) return;

            pu.pickedUp = true;
            if (typeof SFX !== "undefined") SFX.play("powerUp");

            if      (pu.type === "size")    { tank.scale = 0.6;     tank.effectTurns = 4; }
            else if (pu.type === "grow")    { opponent.scale = 1.5;  opponent.effectTurns = 4; }
            else if (pu.type === "missile") {
                tank.state      = "firing";
                tank.animFrame  = 0;
                spawnProjectile(tank, true);
                updateHUD();
            }

            GAME.effects.push({
                type: "muzzle", x: pu.x, y: pu.y - 45,
                angle: -Math.PI / 2, timer: 0.4, max: 0.4
            });
        });
    });

    GAME.powerUps = GAME.powerUps.filter(pu => !pu.pickedUp);
}

function drawPowerUps() {
    GAME.powerUps.forEach(pu => {
        ctx.save();
        ctx.translate(pu.x, pu.y - 45 + Math.sin(pu.bob) * 12);

        // Pixelated aura
        ctx.fillStyle   = pu.type === "size"
            ? "rgba(120,230,255,0.35)"
            : "rgba(255,120,255,0.35)";
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth   = 3;

        const r    = 34;
        const pSz  = 4;
        for (let px = -r; px <= r; px += pSz) {
            for (let py = -r; py <= r; py += pSz) {
                if (px * px + py * py <= r * r &&
                    (Math.abs(px) + Math.abs(py)) % (pSz * 2) === 0) {
                    ctx.fillRect(px, py, pSz, pSz);
                }
            }
        }

        ctx.beginPath();
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
            const bx = Math.round((Math.cos(a) * r) / pSz) * pSz;
            const by = Math.round((Math.sin(a) * r) / pSz) * pSz;
            a === 0 ? ctx.moveTo(bx, by) : ctx.lineTo(bx, by);
        }
        ctx.closePath();
        ctx.stroke();

        // Icon
        const isMissile = pu.type === "missile";
        const icon      = isMissile ? IMAGES["missile1"] : IMAGES["size_power_up"];
        if (icon) {
            ctx.save();
            ctx.rotate(Math.sin(pu.bob * 0.5) * 0.15);
            if (!isMissile) ctx.filter = pu.type === "size" ? "none" : "hue-rotate(120deg)";
            const s = isMissile ? 54 : 42;
            ctx.drawImage(icon, -s / 2, -s / 2, s, s);
            ctx.filter = "none";
            ctx.restore();
        }

        ctx.restore();
    });
}


// ─────────────────────────────────────────────────────────────────────────────
// 8. HUD
// ─────────────────────────────────────────────────────────────────────────────

function drawCanvasHUD() {
    const margin = 20;
    const barW   = 240;
    const barH   = 14;

    drawBar(margin,                      margin, barW, barH,
        player.hp / player.maxHp, "#71e07a",
        player.name || "COMMANDER", player.angle, player.power);

    drawBar(GAME.width - barW - margin,  margin, barW, barH,
        enemy.hp  / enemy.maxHp,  "#ff6b6b",
        enemy.name  || "ENEMY ACES",  enemy.angle,  enemy.power);

    drawCenterStats();
    drawAmmoHotbar();
}

function drawBar(x, y, w, h, percent, color, label, angle, power) {
    const isPlayer = label === "COMMANDER";

    // Track
    ctx.fillStyle = "rgba(6,14,24,0.8)";
    roundRect(ctx, x, y, w, h, 7, true, true);

    // Fill
    if (percent > 0) {
        ctx.fillStyle = color;
        roundRect(ctx, x, y, w * percent, h, 7, true, false);
        ctx.save();
        ctx.shadowBlur  = 12;
        ctx.shadowColor = color;
        ctx.stroke();
        ctx.restore();
    }

    // Name label
    ctx.fillStyle    = "#fff";
    ctx.font         = "bold 13px 'Orbitron', sans-serif";
    ctx.textAlign    = isPlayer ? "left" : "right";
    ctx.textBaseline = "top";
    ctx.fillText(label, x + (isPlayer ? 0 : w), y + h + 10);

    // Angle / power sub-label
    ctx.font      = "600 12px 'Rajdhani', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.textAlign = isPlayer ? "left" : "right";
    ctx.fillText(
        `ANG: ${Math.round(isPlayer ? -angle : angle + 180)}°  |  PWR: ${Math.round(power)}%`,
        x + (isPlayer ? 0 : w), y + h + 28
    );

    // HP %
    ctx.fillStyle = color;
    ctx.font      = "bold 12px 'Orbitron', sans-serif";
    ctx.textAlign = isPlayer ? "right" : "left";
    ctx.fillText(Math.round(percent * 100) + "%", x + (isPlayer ? w : 0), y + h + 10);
}

function drawCenterStats() {
    const cx     = GAME.width / 2;
    const panelW = 320;
    const panelH = 94;
    const px     = cx - panelW / 2;
    const py     = 10;

    // Panel background
    ctx.fillStyle   = "rgba(6,14,24,0.82)";
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth   = 1;
    roundRect(ctx, px, py, panelW, panelH, 14, true, true);

    // Accent bar
    ctx.fillStyle = "rgba(255,213,79,0.6)";
    ctx.fillRect(px + 20, py, panelW - 40, 2);

    // Row 1 — round / kill counter
    ctx.font         = "bold 9px 'Orbitron', sans-serif";
    ctx.fillStyle    = "rgba(255,255,255,0.35)";
    ctx.textAlign    = "center";
    ctx.textBaseline = "top";
    ctx.fillText(
        GAME.mode === "endless" ? `KILLS: ${GAME.killedEnemies}` : `ROUND ${GAME.round}`,
        cx, py + 7
    );

    // Row 2 — score
    ctx.font      = "bold 24px 'Orbitron', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(
        GAME.mode === "endless"
            ? `SCORE: ${GAME.playerScore}`
            : `${GAME.playerScore}  —  ${GAME.enemyScore}`,
        cx, py + 20
    );

    // Row 3 — turn indicator
    const isPlayer  = GAME.turn === "player";
    const turnName  = (isPlayer ? player.name : enemy.name) || (isPlayer ? "PLAYER" : "ENEMY");
    const shots     = isPlayer ? GAME.playerShots     : GAME.enemyShots;
    const hits      = isPlayer ? GAME.playerHits      : GAME.enemyHits;
    const consec    = isPlayer ? GAME.playerConsecutiveHits : GAME.enemyConsecutiveHits;

    ctx.font      = "bold 10px 'Orbitron', sans-serif";
    ctx.fillStyle = isPlayer ? "#71e07a" : "#ff6b6b";
    ctx.fillText(
        isPlayer ? `▶  ${turnName.toUpperCase()} TURN` : `${turnName.toUpperCase()} TURN  ◀`,
        cx, py + 50
    );

    if (consec > 0) {
        ctx.font      = "bold 14px 'Orbitron', sans-serif";
        ctx.fillStyle = consec >= 3 ? "#ffd16a" : "#9cd5ff";
        ctx.fillText(
            consec >= 3 ? `ARCFIRE ${consec}X` : `${consec}X COMBO`,
            cx, py + 72
        );
    }

    // Wind block (left)
    const ws      = GAME.wind;
    const wDir    = ws > 0.01 ? "→" : (ws < -0.01 ? "←" : "•");
    const wText   = (Math.abs(ws) * 100).toFixed(1);
    ctx.textAlign = "left";
    ctx.font      = "bold 9px 'Orbitron', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.38)";
    ctx.fillText("WIND", px + 14, py + 18);
    ctx.font      = "600 14px 'Rajdhani', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(`${wDir} ${wText}`, px + 14, py + 32);

    // Shots / hits (right)
    ctx.textAlign = "right";
    ctx.font      = "bold 9px 'Orbitron', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.38)";
    ctx.fillText("SHOTS / HITS", px + panelW - 14, py + 18);
    ctx.font      = "600 14px 'Rajdhani', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(`${shots} / ${hits}`, px + panelW - 14, py + 32);
}

function drawAmmoHotbar() {
    const activeTank = GAME.turn === "player" ? player : enemy;
    const boxSize    = 56;
    const margin     = 8;
    const totalW     = boxSize * 4 + margin * 3;
    const startX     = GAME.width / 2 - totalW / 2;
    const startY     = GAME.height - boxSize - 18;

    for (let i = 0; i < 4; i++) {
        const x          = startX + i * (boxSize + margin);
        const y          = startY;
        const isSelected = activeTank.selectedAmmoSlot === i;
        const isUnlocked = GAME.mode === "multiplayer" ||
            (activeTank === player ? GAME.ammoUnlocked[i] : true);

        // Box
        ctx.fillStyle   = isSelected
            ? "rgba(255,213,79,0.15)"
            : (!isUnlocked ? "rgba(255,255,255,0.02)" : "rgba(6,14,24,0.85)");
        ctx.strokeStyle = isSelected
            ? "#ffd54f"
            : (!isUnlocked ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.12)");
        ctx.lineWidth   = isSelected ? 2.5 : 1;
        roundRect(ctx, x, y, boxSize, boxSize, 10, true, true);

        if (isSelected) {
            ctx.save();
            ctx.shadowBlur  = 12;
            ctx.shadowColor = "rgba(255,213,79,0.6)";
            ctx.stroke();
            ctx.restore();
        }

        // Slot number
        ctx.fillStyle    = isSelected ? "#ffd54f" : "rgba(255,255,255,0.3)";
        ctx.font         = "bold 9px 'Orbitron', sans-serif";
        ctx.textAlign    = "left";
        ctx.textBaseline = "top";
        ctx.fillText(i + 1, x + 6, y + 4);

        if (!isUnlocked) {
            ctx.fillStyle    = "rgba(255,255,255,0.15)";
            ctx.font         = "18px serif";
            ctx.textAlign    = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("🔒", x + boxSize / 2, y + boxSize / 2);
            continue;
        }

        // Ammo count badge
        const remaining = activeTank.ammoCounts ? activeTank.ammoCounts[i] : Infinity;
        const isEmpty   = remaining !== Infinity && remaining <= 0;
        ctx.font         = "bold 11px 'Orbitron', sans-serif";
        ctx.textAlign    = "right";
        ctx.textBaseline = "top";
        ctx.fillStyle    = isEmpty ? "rgba(255,100,100,0.8)" : "rgba(255,255,255,0.75)";
        ctx.fillText(remaining === Infinity ? "∞" : remaining, x + boxSize - 5, y + 4);

        // Icon
        const iconImg = IMAGES[`ammo_${GAME.ammoTypes[i].toLowerCase()}`];
        if (iconImg && iconImg.complete) {
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(iconImg, x + (boxSize - 32) / 2, y + 12, 32, 32);
            ctx.imageSmoothingEnabled = false;
        } else {
            ctx.beginPath();
            ctx.arc(x + boxSize / 2, y + 18, 6, 0, Math.PI * 2);
            ctx.fillStyle = isSelected ? "#ffd54f" : "#555";
            ctx.fill();
        }

        // Ammo name
        ctx.fillStyle    = isEmpty
            ? "rgba(255,200,200,0.9)"
            : (isSelected ? "#ffffff" : "rgba(255,255,255,0.8)");
        ctx.font         = "bold 10px 'Rajdhani', sans-serif";
        ctx.textAlign    = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(GAME.ammoTypes[i], x + boxSize / 2, y + boxSize - 2);
    }
}

function drawWindOverlay() {
    if (GAME.state === "intro" || GAME.winner) return;
    const ws = GAME.wind;
    if (Math.abs(ws) < 0.005) return;

    ctx.save();
    const strength  = Math.min(1, Math.abs(ws) * 12);
    const numStreaks = Math.ceil(18 + Math.abs(ws) * 170);
    const t          = (Date.now() / 1000) % 1;

    for (let i = 0; i < numStreaks; i++) {
        const seed  = (i * 0.6180339887) % 1;
        const y     = 40 + seed * (GAME.height - 90);
        const len   = 40 + seed * (80 + Math.abs(ws) * 40);
        const ox    = ((seed + t * Math.sign(ws)) % 1) * (GAME.width + len) - len * 0.5;
        ctx.globalAlpha = 0.08 + seed * 0.22 * strength;
        ctx.strokeStyle = `rgba(190,220,255,${0.5 + strength * 0.4})`;
        ctx.lineWidth   = 1 + seed * 2;
        ctx.beginPath();
        ctx.moveTo(ox,                               y);
        ctx.lineTo(ox + (ws > 0 ? len : -len), y + (seed - 0.5) * 10);
        ctx.stroke();
    }

    if (Math.abs(ws) > 0.02) {
        const arrowSize = Math.min(120, 60 + Math.abs(ws) * 330);
        const dir       = ws > 0 ? 1 : -1;
        const cx        = GAME.width / 2;
        const cy        = 34;
        const head      = arrowSize * 0.11;
        const bx        = cx + dir * arrowSize * 0.45;

        ctx.beginPath();
        ctx.moveTo(cx - dir * arrowSize * 0.45, cy);
        ctx.lineTo(bx, cy);
        ctx.strokeStyle = `rgba(255,255,255,${0.75 + strength * 0.25})`;
        ctx.lineWidth   = 5;
        ctx.stroke();

        ctx.fillStyle = `rgba(255,255,255,${0.8 + strength * 0.2})`;
        ctx.beginPath();
        ctx.moveTo(bx,               cy);
        ctx.lineTo(bx - dir * head,  cy - head * 0.8);
        ctx.lineTo(bx - dir * head,  cy + head * 0.8);
        ctx.closePath();
        ctx.fill();
    }

    ctx.restore();
}

function drawHint() {
    if (!GAME.showHint || GAME.turn !== "player" || GAME.state !== "aiming") return;

    const alpha = Math.min(1, GAME.hintTimer * 0.5);
    const cx    = GAME.width / 2;
    const cy    = GAME.height - 48;
    const text  = "A/D: Move  |  ↑↓: Aim  |  ←→: Power  |  Space: Fire  |  ESC: Pause";

    ctx.save();
    ctx.globalAlpha  = alpha;
    ctx.font         = "bold 13px 'Rajdhani', Arial";
    const tw = ctx.measureText(text).width;
    const pw = tw + 32, ph = 28;

    ctx.fillStyle = "rgba(6,14,24,0.82)";
    roundRect(ctx, cx - pw / 2, cy - ph / 2, pw, ph, 14, true, true);

    ctx.fillStyle    = "rgba(255,213,79,0.85)";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx, cy);
    ctx.restore();
}


// ─────────────────────────────────────────────────────────────────────────────
// 9. OVERLAYS — title, combo banner
// ─────────────────────────────────────────────────────────────────────────────

function drawTitleScreen() {
    const img = IMAGES["title_page"];
    if (img && img.complete) {
        ctx.drawImage(img, 0, 0, GAME.width, GAME.height);
    } else {
        ctx.fillStyle = "#060e18";
        ctx.fillRect(0, 0, GAME.width, GAME.height);
    }

    const alpha = 0.5 + Math.sin(GAME.titleTimer * 4) * 0.5;
    ctx.save();
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.font         = "bold 28px 'Orbitron', sans-serif";
    ctx.shadowBlur   = 10;
    ctx.shadowColor  = `rgba(255,213,79,${alpha * 0.5})`;
    ctx.fillStyle    = `rgba(255,213,79,${alpha})`;
    ctx.fillText("PRESS ANY KEY", GAME.width / 2, GAME.height - 80);
    ctx.restore();
}

function drawComboBanner() {
    if (!GAME.comboPopup || GAME.comboPopup.timer <= 0) return;

    const banner = GAME.comboPopup;
    const alpha  = Math.min(1, banner.timer / 1.1);
    const size   = 34 + Math.round(banner.scale * 5);

    ctx.save();
    ctx.translate(GAME.width / 2, GAME.height * 0.2);
    ctx.rotate(Math.sin(banner.scale * 4.2) * 0.05);
    ctx.globalAlpha      = alpha;
    ctx.font             = `bold ${size}px 'Orbitron', sans-serif`;
    ctx.textAlign        = "center";
    ctx.fillStyle        = banner.color;
    ctx.shadowColor      = "rgba(0,0,0,0.35)";
    ctx.shadowBlur       = 18;
    ctx.fillText(banner.text, 0, 0);
    ctx.shadowBlur       = 0;
    ctx.strokeStyle      = "rgba(255,255,255,0.18)";
    ctx.lineWidth        = 3;
    ctx.strokeText(banner.text, 0, 0);
    ctx.restore();
}


// ─────────────────────────────────────────────────────────────────────────────
// 10. MASTER render() — called every frame from gameLoop()
// ─────────────────────────────────────────────────────────────────────────────

function render() {
    const shakeX = GAME.screenShake > 0 ? (Math.random() - 0.5) * GAME.screenShake : 0;
    const shakeY = GAME.screenShake > 0 ? (Math.random() - 0.5) * GAME.screenShake : 0;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // ── World layers (back → front) ──────────────────────────────────────────
    drawBackground();
    drawTerrain();
    drawCraters();
    drawBurnZones();
    drawObstacles();
    drawTank(player);
    drawTank(enemy);

    // ── Game-state conditional layers ────────────────────────────────────────
    if (GAME.state === "title") {
        drawTitleScreen();
    } else if (GAME.state !== "intro") {
        drawAimGuide();
        drawPowerUps();
        drawProjectile();
        drawEffects();
        drawWindOverlay();
        drawHint();
        drawCanvasHUD();
        drawComboBanner();
    }

    ctx.restore();

    // Screen flash (drawn outside shake transform so it covers the whole canvas)
    if (GAME.flashTimer > 0) {
        ctx.save();
        ctx.globalAlpha = GAME.flashTimer * 6;
        ctx.fillStyle   = "#fff7cc";
        ctx.fillRect(0, 0, GAME.width, GAME.height);
        ctx.restore();
    }
}