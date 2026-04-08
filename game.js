// ── ArcFire Main entry point ────────────────────────────────────────────────

function getSafeTankX(preferredX) {
    // Smarter spawn placement: search outward from preferredX alternating
    // left/right with small steps until a safe X is found. Avoids spawning
    // tanks inside obstacle horizontal footprints (takes tank width into account).
    const tankHalfWidth = 48;
    const margin = 12; // extra breathing room
    const step = 16;
    const maxAttempts = 60;

    const isBlocked = (x) => GAME.obstacles.some(obs => {
        if (!obs.alive) return false;
        const obsHalf = (obs.width || 48) / 2;
        const minX = obs.x - obsHalf - tankHalfWidth - margin;
        const maxX = obs.x + obsHalf + tankHalfWidth + margin;
        return x >= minX && x <= maxX;
    });

    // Clamp preferredX into play bounds first
    const minBound = 80;
    const maxBound = GAME.width - 80;
    preferredX = Math.max(minBound, Math.min(maxBound, preferredX));

    if (!isBlocked(preferredX)) return preferredX;

    for (let i = 1; i <= maxAttempts; i++) {
        const left = preferredX - i * step;
        const right = preferredX + i * step;
        if (left >= minBound && !isBlocked(left)) return left;
        if (right <= maxBound && !isBlocked(right)) return right;
    }

    // Attach direct parent references for stacked obstacles (helps resolver)
    const obsById = {};
    GAME.obstacles.forEach(o => { if (o && o.id) obsById[o.id] = o; });
    GAME.obstacles.forEach(o => { if (o && o.stackedOn && obsById[o.stackedOn]) o.parentRef = obsById[o.stackedOn]; });

    // Fallback to clamped preferredX
    return preferredX;
}

function resetGame() {
    GAME.effects = [];
    GAME.projectile = null;
    GAME.state = "aiming";
    GAME.turn = "player";
    GAME.winner = null;
    GAME.flashTimer = 0;
    GAME.screenShake = 0;
    GAME.powerUps = [];
    GAME.craters = [];
    GAME.burnZones = [];
    GAME.comboPopup = null;

    // Ensure any looping napalm audio is silenced on reset.
    if (typeof SFX !== "undefined") SFX.stopLoop("napalmBurn");

    player.x = 130;
    enemy.x = 960;
    player.hp = 100;
    enemy.hp = 100;
    player.angle = -35;
    enemy.angle = -145;
    player.power = 55;
    enemy.power = 50;
    player.trackFrame = 0;
    enemy.trackFrame = 0;
    player.bob = 0;
    enemy.bob = 0;
    player.hitFlash = 0;
    enemy.hitFlash = 0;
    player.alive = true;
    enemy.alive = true;
    player.state = "parachuting";
    enemy.state = "parachuting";
    player.animTimer = 0;
    enemy.animTimer = 0;
    player.animFrame = 0;
    enemy.animFrame = 0;
    player.scale = 1.0;
    enemy.scale = 1.0;
    player.effectTurns = 0;
    enemy.effectTurns = 0;
    player.stuckTurns = 0;
    enemy.stuckTurns = 0;
    player.hasHomingMissile = false;
    enemy.hasHomingMissile = false;

    // Ammo inventory reset (Preserve unlocked status, but refill some base amounts)
    player.ammoCounts = [Infinity, Math.max(player.ammoCounts[1], 3), Math.max(player.ammoCounts[2], 2), Math.max(player.ammoCounts[3], 2)];
    // Enemy gets fresh ammo every round
    enemy.ammoCounts = [Infinity, 3, 4, 4];
    player.selectedAmmoSlot = 0;
    enemy.selectedAmmoSlot = 0;
    player.parachuteY = -100;
    enemy.parachuteY = -100;
    player.landed = false;
    enemy.landed = false;
    player.landingScheduled = false;
    enemy.landingScheduled = false;
    player.landingTimer = 0;
    enemy.landingTimer = 0;

    const levelVal = document.getElementById("levelSelect").value;
    if (levelVal === "random") {
        GAME.level = Math.floor(Math.random() * 9) + 1;
    } else {
        GAME.level = parseInt(levelVal, 10) || 1;
    }
    GAME.theme = Math.random() < 0.5 ? "bright" : "pale";

    createTerrain();
    createSkyDecor();

    const barrels = ["obs_barrel_red", "obs_barrel_green", "obs_barrel_grey"];
    const crates = ["obs_crate_wood"];

    // Per-level obstacle appearance sets (use different mixes per level)
    const LEVEL_OBSTACLE_SETS = {
        1: ["obs_crate_wood"],                         // Wood crate focused
        2: ["obs_barrel_red", "obs_barrel_grey"],   // Barrels (desert/ruins)
        3: ["obs_barrel_green", "obs_crate_wood"],  // Mixed urban
        4: ["obs_barrel_grey", "obs_crate_wood"],   // Night city mix
        // Procedural levels: include both types but vary shapes
        5: [...barrels, ...crates],
        6: [...barrels, ...crates],
        7: [...barrels, ...crates],
        8: [...barrels, ...crates],
        9: [...barrels, ...crates]
    };

    const obsList = LEVEL_OBSTACLE_SETS[GAME.level] || [...barrels, ...crates];

    const OBSTACLE_SIZE = 48;
    const OBSTACLE_HEIGHT = 48;
    const STACK_PATTERNS = [
        [[1]],
        [[1, 1]],
        [[1], [1]],
        [[1, 1], [1, 1]],
        [[1, 1, 1]],
        [[1], [1, 1], [1, 1, 1]],
        [[1, 1, 1], [1, 1, 1], [1, 1, 1]]
    ];
    const SINGLE_PLAYER_PATTERNS = {
        1: [[1]],                     // Single block
        2: [[1], [1]],               // Two stacked blocks
        3: [[1, 1], [1, 1]],         // 2x2 square
        4: [[1], [1, 1], [1, 1, 1]]  // Pyramid
    };

    // Define stacked patterns for creating vertical structures
    const STACKED_PATTERNS = {
        "2x2": [
            [1, 1],
            [1, 1]
        ],
        "3x3": [
            [1, 1, 1],
            [1, 1, 1],
            [1, 1, 1]
        ],
        "pyramid": [
            [1],           // Top of pyramid
            [1, 1],        // Middle layer
            [1, 1, 1]      // Base layer
        ]
    };

    GAME.obstacles = [];
    let numStructures = GAME.mode === 'single' ? 1 : Math.floor(Math.random() * 2) + 1 + Math.floor(GAME.difficulty / 3);
    // For procedural levels (5+), skip the earlier random structures — we'll
    // generate mapped formations later so the field matches the level design.
    if (GAME.level > 4) numStructures = 0;
    const placedRanges = [];
    let obstacleIdCounter = 1;

    for (let i = 0; i < numStructures; i++) {
        let structure;
        if (GAME.mode === 'single') {
            // Use specific patterns for single player mode
            if (GAME.level === 1) {
                structure = [[1]]; // Single block
            } else if (GAME.level === 2) {
                structure = [[1], [1]]; // Two stacked blocks
            } else if (GAME.level === 3) {
                structure = STACKED_PATTERNS["2x2"]; // 2x2 square
            } else if (GAME.level === 4) {
                structure = STACKED_PATTERNS.pyramid; // Pyramid
            } else {
                structure = STACK_PATTERNS[0]; // Default fallback
            }
        } else {
            // Random pattern for other modes
            structure = STACK_PATTERNS[Math.floor(Math.random() * STACK_PATTERNS.length)];
        }
        
        // For pyramid pattern, we need to handle the centering differently
        if (GAME.mode === 'single' && GAME.level === 4) {
            // Keep the pyramid structure as is, but we'll handle centering in positioning
        } else {
            // Filter out any zero values (empty spaces in pyramid pattern)
            structure = structure.map(row => row.filter(cell => cell !== 0));
            // Remove empty rows
            structure = structure.filter(row => row.length > 0);
        }
        
        // Special handling for pyramid to center rows properly
        if (GAME.mode === 'single' && GAME.level === 4) {
            // The pyramid structure is already centered in our definition
        }
        
        let structureWidth = Math.max(...structure.map(row => row.length));
        let halfWidth = (structureWidth * OBSTACLE_SIZE) / 2;
        let candidateX = null;

        for (let attempt = 0; attempt < 30; attempt++) {
            let ox = 120 + halfWidth + Math.random() * (GAME.width - 240 - structureWidth * OBSTACLE_SIZE);
            let left = ox - halfWidth - 8;
            let right = ox + halfWidth + 8;
            let overlaps = placedRanges.some(range => !(right < range.left || left > range.right));
            if (!overlaps) {
                candidateX = ox;
                placedRanges.push({ left, right });
                break;
            }
        }

        if (candidateX === null) continue;

        let hp = 80 + (GAME.difficulty - 1) * 20;
        const baseKeys = [];
        for (let row of structure) {
            for (let col = 0; col < row.length; col++) {
                baseKeys.push(obsList[Math.floor(Math.random() * obsList.length)]);
            }
        }

        // Create a mapping of obstacle positions to IDs for stacking
        const obstaclePositions = {};
        let keyIndex = 0;
        const leftOrigin = candidateX - halfWidth;
        
        // Special handling for pyramid to center rows properly
        let rowOffsets = [];
        if (GAME.mode === 'single' && GAME.level === 4) {
            // Calculate centering offsets for each row of the pyramid
            const maxWidth = Math.max(...structure.map(row => row.length));
            rowOffsets = structure.map(row => (maxWidth - row.length) * 0.5 * OBSTACLE_SIZE);
        }
        
        // Process from bottom to top to ensure proper stacking
        for (let row = structure.length - 1; row >= 0; row--) {
            const cells = structure[row];
            const rowOffset = (GAME.mode === 'single' && GAME.level === 4) 
                ? rowOffsets[row] 
                : (structureWidth - cells.length) * 0.5 * OBSTACLE_SIZE;
            
            for (let col = 0; col < cells.length; col++) {
                const cellX = leftOrigin + (col * OBSTACLE_SIZE) + rowOffset;
                // Choose image key from the level-specific obsList
                const baseKey = baseKeys[keyIndex++] || obsList[Math.floor(Math.random() * obsList.length)];
                let attemptKey = baseKey;
                let imgKey = null;
                let obsType = "image";

                const img = IMAGES[attemptKey];
                if (img && img.complete && img.naturalWidth > 0) {
                    imgKey = attemptKey;
                } else {
                    obsType = Math.random() > 0.5 ? "bunker" : "rockwall";
                    imgKey = null;
                }

                // Calculate the Y position based on terrain or stacking
                let cellY;
                let parentId = null;
                
                // For stacked structures, link to the obstacle directly below
                if (row < structure.length - 1) {
                    // This is not the bottom row, so it should be stacked
                    const belowRow = row + 1;
                    if (belowRow < structure.length) {
                        const belowCells = structure[belowRow];
                        // Find the cell directly below this one
                        // Simple mapping: try to align columns as best as possible
                        let belowCol = col;
                        if (belowCells.length !== cells.length) {
                            // Scale the column index to match the below row
                            belowCol = Math.floor(col * (belowCells.length / cells.length));
                            // Make sure it's within bounds
                            belowCol = Math.max(0, Math.min(belowCol, belowCells.length - 1));
                        }
                        
                        const parentPosKey = `${belowRow}-${belowCol}`;
                        if (obstaclePositions[parentPosKey]) {
                            parentId = obstaclePositions[parentPosKey];
                        }
                    }
                }
                
                // If we have a parent, we'll calculate Y based on stacking
                if (parentId) {
                    cellY = undefined; // Will be calculated during rendering based on parent
                } else {
                    // This is a base obstacle, place it on the terrain
                    cellY = getTerrainY(cellX);
                }
                
                const obstacleId = `obs_${obstacleIdCounter++}`;
                const posKey = `${row}-${col}`;
                obstaclePositions[posKey] = obstacleId;

                const obstacle = {
                    id: obstacleId,
                    x: cellX,
                    y: cellY,
                    width: OBSTACLE_SIZE,
                    height: OBSTACLE_HEIGHT,
                    type: obsType,
                    imgKey: imgKey,
                    hp: hp,
                    maxHp: hp,
                    alive: true
                };
                
                // Add parentId if this obstacle is stacked
                if (parentId) {
                    obstacle.stackedOn = parentId;
                }
                
                GAME.obstacles.push(obstacle);
            }
        }
    }

    // For procedural/random levels, create a few random stacked formations
    if (GAME.level > 4 || GAME.mode === 'endless') {
        // Base HP scaled by difficulty for procedurally generated formations
        const difficulty = Math.max(1, GAME.difficulty || 1);
        const baseHp = 80 + (difficulty - 1) * 20;
        // Exact mapping for procedural levels: procedural index 1–5 (UI shows levels 5–9)
        // We'll map GAME.level 5..9 -> procIndex 1..5 so the formations follow
        // the user's Procedural Level 1..5 specification.
        const LEVEL_FORMATION_MAP = {
            1: [ { cols: 3, rows: 3, mode: 'grid' } ],
            2: [ { cols: 4, rows: 4, mode: 'grid' } ],
            3: [ { cols: 5, rows: 5, mode: 'grid' } ],
            4: [ { cols: 5, rows: 5, mode: 'pyramid' }, { cols: 4, rows: 4, mode: 'grid' } ],
            5: [ { cols: 6, rows: 6, mode: 'grid' }, { cols: 5, rows: 5, mode: 'pyramid' } ]
        };

        // Convert GAME.level (5..9) into procedural index 1..5
        const procIndex = Math.max(1, Math.min(5, GAME.level - 4));
        const mapped = LEVEL_FORMATION_MAP[procIndex];
        if (mapped && mapped.length > 0) {
            // Use exact formations for this level
            mapped.forEach((choice, idx) => {
                const baseX = 140 + (idx + 0.5) * (GAME.width - 280) / Math.max(1, mapped.length);
                const prefix = `lvl${GAME.level}_f${idx}`;
                const form = createObstacleFormation({
                    baseX,
                    cols: choice.cols,
                    rows: choice.rows,
                    obsWidth: OBSTACLE_SIZE,
                    obsHeight: OBSTACLE_HEIGHT,
                    idPrefix: prefix,
                    mode: choice.mode,
                    imgKey: null,
                    hp: baseHp
                });
                form.forEach(o => {
                    const key = obsList[Math.floor(Math.random() * obsList.length)];
                    const img = IMAGES[key];
                    const useImage = img && img.complete && img.naturalWidth > 0;
                    o.imgKey = useImage ? key : null;
                    o.type = useImage ? 'image' : (Math.random() > 0.5 ? 'bunker' : 'rockwall');
                    o.hp = baseHp + (Math.max(0, difficulty - 1) * 10);
                    o.maxHp = o.hp;
                    o.alive = true;
                    GAME.obstacles.push(o);
                });
            });
        } else {
            // Fallback to difficulty-scaled random generator
            const difficulty = Math.max(1, GAME.difficulty || 1);
            const maxBase = Math.min(6, 2 + difficulty + Math.floor(Math.random() * 2));
            const formationCount = Math.min(4, 1 + difficulty + Math.floor(Math.random() * 2));
            const formationChoices = [];
            for (let s = 3; s <= maxBase; s++) {
                formationChoices.push({ cols: s, rows: s, mode: 'grid' });
                formationChoices.push({ cols: s, rows: s, mode: 'pyramid' });
                if (s > 3) formationChoices.push({ cols: s, rows: Math.max(2, s - 1), mode: 'grid' });
            }
            for (let f = 0; f < formationCount; f++) {
                const choice = formationChoices[Math.floor(Math.random() * formationChoices.length)];
                const baseX = 140 + Math.random() * (GAME.width - 280);
                const prefix = `proc_f${f}_${Date.now() % 10000}`;
                const form = createObstacleFormation({
                    baseX,
                    cols: choice.cols,
                    rows: choice.rows,
                    obsWidth: OBSTACLE_SIZE,
                    obsHeight: OBSTACLE_HEIGHT,
                    idPrefix: prefix,
                    mode: choice.mode,
                    imgKey: null,
                    hp: baseHp
                });
                for (let j = 0; j < form.length; j++) {
                    const o = form[j];
                    const key = obsList[Math.floor(Math.random() * obsList.length)];
                    const img = IMAGES[key];
                    const useImage = img && img.complete && img.naturalWidth > 0;
                    o.imgKey = useImage ? key : null;
                    o.type = useImage ? 'image' : (Math.random() > 0.5 ? 'bunker' : 'rockwall');
                    o.hp = baseHp + (difficulty - 1) * 10;
                    o.maxHp = o.hp;
                    o.alive = true;
                    GAME.obstacles.push(o);
                }
            }
        }
    }

    const windMax = GAME.difficultyMode === "easy" ? 0.045 : (GAME.difficultyMode === "hard" ? 0.16 : 0.09);
    GAME.wind = (Math.random() * 2 - 1) * windMax;

    player.x = getSafeTankX(player.x);
    enemy.x = getSafeTankX(enemy.x);

    GAME.playerShots = 0;
    GAME.playerHits = 0;
    GAME.playerDamageDealt = 0;
    GAME.playerConsecutiveHits = 0;
    GAME.enemyShots = 0;
    GAME.enemyHits = 0;
    GAME.enemyDamageDealt = 0;
    GAME.enemyConsecutiveHits = 0;
    GAME.shotHitThisTurn = false;
    GAME.playerPowerUp = null;
    GAME.paused = false;
    GAME.showHint = true;
    GAME.hintTimer = 6;

    updateHUD();
}

function respawnEnemy() {
    enemy.alive = true;
    enemy.hp = enemy.maxHp;
    enemy.state = "parachuting";
    enemy.parachuteY = -120;
    enemy.landed = false;
    enemy.landingScheduled = false;
    enemy.landingTimer = 0;
    enemy.animFrame = 0;
    enemy.animTimer = 0;
    enemy.randomizeParts(); // Modular randomization on rebirth!
    enemy.x = getSafeTankX(700 + Math.random() * 350); // Spawn on the right half
    enemy.angle = -145;
    enemy.power = 50;
    enemy.scale = 1.0;
    enemy.effectTurns = 0;
    enemy.stuckTurns = 0;

    // Play respawn sound if exists
    if (typeof SFX !== "undefined") {
        SFX.play("tankLanding", 0.5);
    }
}

function updateHUD() {
    // HUD is now handled by drawCanvasHUD in the render loop.
}

function update(dt) {
    if (GAME.state === "title" || GAME.state === "intro") return;
    if (GAME.paused) return;

    if (GAME.showHint) {
        GAME.hintTimer -= dt;
        if (GAME.hintTimer <= 0) GAME.showHint = false;
    }

    updatePlayerInput(dt);
    updateProjectile(dt);
    updateEffects(dt);
    updateEnemyAI(dt);
    updatePowerUps(dt);

    // Update parachuting tanks
    [player, enemy].forEach(tank => {
        if (tank.state === "parachuting") {
            const fallSpeed = 120; // pixels per second
            tank.parachuteY += fallSpeed * dt;
            tank.parachuteY += GAME.wind * 0.05 * dt * 60; // Barely affected by wind
            tank.animTimer += dt * 2; // For parachute animation if needed

            const groundY = getTerrainY(tank.x);
            const remaining = groundY - tank.parachuteY;
            const leadTime = 0.5; // seconds
            const leadPixels = fallSpeed * leadTime; // 60 px before impact

            // Play landing cue before splash/impact, not on impact
            if (!tank.landingScheduled && remaining <= leadPixels && remaining > 0) {
                tank.landingScheduled = true;
                if (typeof SFX !== "undefined") {
                    SFX.play("tankLanding", 1.0);
                }
            }

            if (tank.parachuteY + 1 >= groundY) {
                tank.parachuteY = groundY;
                tank.state = "idle";
                tank.landed = true;
                GAME.screenShake = Math.max(GAME.screenShake, 4); // Strong landing shake

                // Dirt splash effect on impact
                GAME.effects.push({
                    type: "dirtSplash",
                    x: tank.x,
                    y: groundY,
                    radius: 30,
                    timer: 0.45,
                    max: 0.45,
                    seed: Math.random(),
                    soundPlayed: false
                });

                // Kick up a few particles for extra weight feel
                for (let i = 0; i < 12; i++) {
                    GAME.debris.push({
                        x: tank.x + (Math.random() - 0.5) * 22,
                        y: groundY - 6,
                        vx: (Math.random() - 0.5) * 2.2,
                        vy: -Math.random() * 3.2 - 1.1,
                        size: 2 + Math.random() * 2,
                        life: 0.4 + Math.random() * 0.35
                    });
                }
            }
        }
    });

    [player, enemy].forEach(tank => {
        if (tank.alive && tank.y >= GAME.height - 5) {
            applyDamage(tank, 9999);
        }
    });

    GAME.obstacles.forEach(obs => {
        if (!obs.alive) return;
        // Don't overwrite stacked obstacles' y here; stacked items are
        // positioned relative to their parents in the render pass.
        if (obs.stackedOn || obs.parentRef) {
            return;
        }
        const targetY = getTerrainY(obs.x);
        if (obs.y === undefined) obs.y = targetY;
        if (obs.y < targetY) obs.y += 150 * dt;
        else obs.y = targetY;
    });

    GAME.clouds.forEach(cloud => {
        cloud.x += cloud.speed;
        if (cloud.x - 40 > GAME.width) cloud.x = -cloud.w;
    });
}

// Keyboard toggle for debug overlays
// Debug overlay toggle removed — rendering checks complete

function render() {
    const shakeX = GAME.screenShake > 0 ? (Math.random() - 0.5) * GAME.screenShake : 0;
    const shakeY = GAME.screenShake > 0 ? (Math.random() - 0.5) * GAME.screenShake : 0;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    drawBackground();
    drawTerrain();
    drawCraters();
    drawBurnZones();
    drawObstacles();
    drawTank(player);
    drawTank(enemy);

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

    if (GAME.flashTimer > 0) {
        ctx.save();
        ctx.globalAlpha = GAME.flashTimer * 6;
        ctx.fillStyle = "#fff7cc";
        ctx.fillRect(0, 0, GAME.width, GAME.height);
        ctx.restore();
    }
}

function gameLoop(timestamp) {
    if (!GAME.lastTime) GAME.lastTime = timestamp;
    const dt = Math.min(0.033, (timestamp - GAME.lastTime) / 1000);
    GAME.lastTime = timestamp;

    update(dt);
    render();

    requestAnimationFrame(gameLoop);
}

document.addEventListener("keydown", e => {
    if (GAME.state === "title") {
        showIntro();
        return;
    }
    const key = e.key.toLowerCase();
    keys[key] = true;

    // Ammo selection (1-4 keys)
    const activeTank = GAME.turn === "player" ? player : enemy;

    // Prevent switching ammo if stuck? 
    // Usually only movement is restricted. I'll allow ammo switching.

    if (key === "1") activeTank.selectedAmmoSlot = 0;
    if (key === "2" && (GAME.mode === 'multiplayer' || activeTank !== player || GAME.ammoUnlocked[1])) activeTank.selectedAmmoSlot = 1;
    if (key === "3" && (GAME.mode === 'multiplayer' || activeTank !== player || GAME.ammoUnlocked[2])) activeTank.selectedAmmoSlot = 2;
    if (key === "4" && (GAME.mode === 'multiplayer' || activeTank !== player || GAME.ammoUnlocked[3])) activeTank.selectedAmmoSlot = 3;

    if (e.key === "Escape") {
        e.preventDefault();
        if (GAME.state === "gameover" || GAME.state === "intro") return;
        togglePause();
        return;
    }

    if (e.code === "Space" || key === " ") {
        e.preventDefault();
        if (GAME.paused) return;
        // Don't allow firing while the active tank is still parachuting.
        if (activeTank.state === "parachuting") return;
        if (GAME.turn === "player" && GAME.state === "aiming" && GAME.projectiles.length === 0 && !GAME.winner) {
            fireCurrentTank();
        }
    }
    // Multiplayer: allow Enter to fire when it's player 2's (enemy) turn
    if (e.key === "Space" || key === " ") {
        e.preventDefault();
        if (GAME.mode === 'multiplayer' && GAME.turn === 'enemy' && GAME.state === 'aiming' && GAME.projectiles.length === 0 && !GAME.winner) {
            // Don't allow firing while the active tank is still parachuting.
            if (activeTank.state === "parachuting") return;
            fireCurrentTank();
        }
    }
});

document.addEventListener("keyup", e => {
    keys[e.key.toLowerCase()] = false;
});

function hideAllScreens() {
    const screens = ["introScreen", "pauseScreen", "gameOverScreen", "shopScreen", "tutorialOverlay"];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add("hidden");
            el.classList.remove("active");
        }
    });
}

function quitToMenu() {
    GAME.state = "title";
    GAME.paused = false;
    showTitleScreen();
    if (typeof SFX !== "undefined") SFX.stopLoop("napalmBurn");
}

function togglePause() {
    if (GAME.winner) return;
    GAME.paused = !GAME.paused;
    const ps = document.getElementById("pauseScreen");
    if (GAME.paused) {
        ps.classList.remove("hidden");
    } else {
        ps.classList.add("hidden");
    }
}

function showTitleScreen() {
    GAME.state = "title";
    hideAllScreens();
    document.getElementById("introScreen").classList.add("active");
    // Initialize customization (null type for full refresh)
    cyclePart(null, 0);
    document.getElementById("pauseScreen").classList.add("hidden");
    document.getElementById("gameOverScreen").classList.add("hidden");
    const mBtn = document.getElementById("menuBtn");
    if (mBtn) mBtn.classList.add("hidden");
    GAME.paused = false;
}

function showIntro() {
    document.getElementById("introScreen").classList.remove("hidden");
    document.getElementById("pauseScreen").classList.add("hidden");
    const mBtn = document.getElementById("menuBtn");
    if (mBtn) mBtn.classList.add("hidden");
    GAME.state = "intro";
    GAME.paused = false;
}

let hasSeenTutorial = false;

function showTutorialOverlay() {
    document.getElementById("tutorialOverlay").classList.remove("hidden");
}

function hideTutorialOverlay() {
    document.getElementById("tutorialOverlay").classList.add("hidden");
}

function startGame() {
    const activeBtn = document.querySelector(".diff-btn.active");
    GAME.difficultyMode = activeBtn ? activeBtn.dataset.diff : "normal";

    // Read selected game mode: '1' = Multiplayer, '2' = Single Player, '3' = Endless
    const modeEl = document.getElementById('modeSelect');
    const modeVal = modeEl ? modeEl.value : '2';

    if (modeVal === '1') {
        GAME.mode = 'multiplayer';
        GAME.useAI = false;
    } else if (modeVal === '3') {
        GAME.mode = 'endless';
        GAME.useAI = true;
    } else {
        GAME.mode = 'single';
        GAME.useAI = true;
    }

    // Update tank names for multiplayer mode
    if (GAME.mode === 'multiplayer') {
        player.name = 'Player 1';
        enemy.name = 'Player 2';
    } else if (GAME.mode === 'endless') {
        player.name = 'Player';
        enemy.name = 'Enemy Wave';
    } else {
        player.name = 'Player';
        enemy.name = 'Enemy';
    }

    document.getElementById("introScreen").classList.add("hidden");
    document.getElementById("gameOverScreen").classList.add("hidden");
    const mBtn = document.getElementById("menuBtn");
    if (mBtn) mBtn.classList.remove("hidden");

    if (typeof SFX !== "undefined") {
        SFX.init(); // ensure all sound assets are loaded before first impact
        SFX.warm("tankLanding"); // warm up audio path to avoid first-play lag
        // extra fallback in case warm needs a tick to stabilize
        setTimeout(() => SFX.warm("tankLanding"), 120);
    }
    // Ensure the game canvas is visible when the battle starts
    const canvasEl = document.getElementById('game');
    if (canvasEl) canvasEl.style.display = '';

    GAME.difficulty = 1;
    GAME.round = 1;
    GAME.playerScore = 0;
    GAME.enemyScore = 0;
    GAME.killedEnemies = 0;
    resetGame();

    // If terrain hasn't been created yet (user skipped tutorial confirmation), create it now
    if (!GAME.terrain || GAME.terrain.length === 0) {
        createTerrain();
        createSkyDecor();
    }

    // Configure the game over / next button behavior according to mode
    const nextBtn = document.getElementById("nextLevelBtn");
    if (nextBtn) {
        if (GAME.mode === 'multiplayer') {
            nextBtn.textContent = 'Play Again';
            nextBtn.style.display = 'inline-block';
            nextBtn.onclick = function () {
                document.getElementById("gameOverScreen").classList.add("hidden");
                GAME.winner = null;
                resetGame();
            };
        } else {
            nextBtn.textContent = 'Next Level';
            nextBtn.onclick = loadNextLevel;
        }
    }

    if (!hasSeenTutorial) {
        hasSeenTutorial = true;
        // Do not force tutorial overlay; users should see gameplay immediately.
        // If they want tutorial, they can open from menu or tutorial tab.
        hideTutorialOverlay();
    }
}

function loadNextLevel() {
    document.getElementById("gameOverScreen").classList.add("hidden");
    GAME.difficulty++;

    let levelVal = document.getElementById("levelSelect").value;
    if (levelVal !== "random") {
        let lv = parseInt(levelVal, 10) || 1;
        document.getElementById("levelSelect").value = lv < 9 ? (lv + 1).toString() : "random";
    }
    resetGame();
}

function quitToMenu() {
    document.getElementById("gameOverScreen").classList.add("hidden");
    showIntro();
}

function playAgain() {
    document.getElementById("gameOverScreen").classList.add("hidden");
    GAME.winner = null;
    resetGame();
}

const diffDescMap = {
    easy: "AI misses often. Very little wind. Great for beginners.",
    normal: "Balanced AI with moderate wind.",
    hard: "High-accuracy AI with strong unpredictable wind."
};

document.querySelectorAll(".diff-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".diff-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const dd = document.getElementById("diffDesc");
        if (dd) dd.textContent = diffDescMap[btn.dataset.diff] || "";
    });
});

const modeSelectBox = document.getElementById("modeSelect");
if (modeSelectBox) {
    function updateDiffSelectorState() {
        const diffBtns = document.getElementById("diffBtns");
        if (!diffBtns) return;
        if (modeSelectBox.value === "1") {
            diffBtns.style.pointerEvents = "none";
            diffBtns.style.opacity = "0.5";
        } else {
            diffBtns.style.pointerEvents = "auto";
            diffBtns.style.opacity = "1";
        }
    }
    modeSelectBox.addEventListener("change", updateDiffSelectorState);
    updateDiffSelectorState(); // Initialize state on load
}

const mBtn = document.getElementById("menuBtn");
if (mBtn) mBtn.addEventListener("click", () => {
    if (GAME.state === "intro" || GAME.state === "gameover") showIntro();
    else togglePause();
});

const startBtn = document.getElementById("startBtn");
if (startBtn) {
    startBtn.addEventListener("click", () => {
        startGame();
        // Immediately enter gameplay if tutorial overlay is auto-shown
        if (!hasSeenTutorial) {
            hasSeenTutorial = true;
            hideTutorialOverlay();
        }
    });
}

const nextLevelBtn = document.getElementById("nextLevelBtn");
if (nextLevelBtn) nextLevelBtn.addEventListener("click", loadNextLevel);

const endMenuBtn = document.getElementById("endMenuBtn");
if (endMenuBtn) endMenuBtn.addEventListener("click", quitToMenu);

const resumeBtn = document.getElementById("resumeBtn");
if (resumeBtn) resumeBtn.addEventListener("click", togglePause);

const pauseMenuBtn = document.getElementById("pauseMenuBtn");
if (pauseMenuBtn) pauseMenuBtn.addEventListener("click", () => { GAME.paused = false; quitToMenu(); });

document.querySelectorAll(".menu-tab").forEach(tab => {
    tab.addEventListener("click", () => {
        const targetTab = tab.dataset.tab;
        document.querySelectorAll(".menu-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        document.querySelectorAll(".tab-content").forEach(content => {
            content.classList.remove("active");
            if (content.id === `tab-${targetTab}`) content.classList.add("active");
        });
        if (targetTab === "customize") cyclePart(null, 0);
        GAME.screenShake = 2;
    });
});

// ── SHOP SYSTEM ──────────────────────────────────────────────────────────

function openShop() {
    document.getElementById("gameOverScreen").classList.add("hidden");
    document.getElementById("shopScreen").classList.remove("hidden");
    updateShopUI();
}

function closeShop() {
    document.getElementById("shopScreen").classList.add("hidden");
    document.getElementById("gameOverScreen").classList.remove("hidden");
}

function updateShopUI() {
    document.getElementById("shopCreditsDisplay").textContent = GAME.credits;

    // Update Upgrade buttons
    const armorLvl = GAME.playerUpgrades.armor;
    const armorPrice = GAME.upgradePrices.armor[armorLvl];
    document.getElementById("armorLvl").textContent = `LVL ${armorLvl}`;
    const armorBtn = document.getElementById("buyArmorBtn");
    if (armorLvl >= 5) {
        armorBtn.disabled = true;
        document.getElementById("armorPrice").textContent = "MAXED";
    } else {
        armorBtn.disabled = GAME.credits < armorPrice;
        document.getElementById("armorPrice").textContent = `${armorPrice} Cr`;
    }

    const pointerLvl = GAME.playerUpgrades.pointer;
    const pointerPrice = GAME.upgradePrices.pointer[pointerLvl];
    document.getElementById("pointerLvl").textContent = `LVL ${pointerLvl}`;
    const pointerBtn = document.getElementById("buyPointerBtn");
    if (pointerLvl >= 5) {
        pointerBtn.disabled = true;
        document.getElementById("pointerPrice").textContent = "MAXED";
    } else {
        pointerBtn.disabled = GAME.credits < pointerPrice;
        document.getElementById("pointerPrice").textContent = `${pointerPrice} Cr`;
    }

    // Populate Ammo Shop
    const ammoContainer = document.getElementById("ammoShopList");
    ammoContainer.innerHTML = "";

    for (let i = 1; i < GAME.ammoTypes.length; i++) {
        const name = GAME.ammoTypes[i];
        const unlocked = GAME.ammoUnlocked[i];
        const count = player.ammoCounts[i];
        const unlockPrice = GAME.ammoPrices.unlock[i];
        const refillPrice = GAME.ammoPrices.refill[i];

        const item = document.createElement("div");
        item.className = "ammo-shop-item";

        let actionBtnHtml = "";
        if (!unlocked) {
            actionBtnHtml = `
                <button class="shop-buy-btn" onclick="buyAmmo(${i}, false)" ${GAME.credits < unlockPrice ? 'disabled' : ''}>
                    <div class="buy-label">UNLOCK</div>
                    <div class="buy-price">${unlockPrice} Cr</div>
                </button>
            `;
        } else {
            actionBtnHtml = `
                <button class="shop-buy-btn" onclick="buyAmmo(${i}, true)" ${GAME.credits < refillPrice ? 'disabled' : ''}>
                    <div class="buy-label">REFILL +5</div>
                    <div class="buy-price">${refillPrice} Cr</div>
                </button>
            `;
        }

        item.innerHTML = `
            <div class="up-info">
                <div class="up-name">${name.toUpperCase()} <span class="ammo-status ${unlocked ? 'ammo-unlocked' : 'ammo-locked'}">${unlocked ? 'UNLOCKED' : 'LOCKED'}</span></div>
                <div class="up-desc">${unlocked ? 'In Stock: ' + count : 'Strategic munition. Precise payload.'}</div>
            </div>
            ${actionBtnHtml}
        `;
        ammoContainer.appendChild(item);
    }
}

function buyUpgrade(type) {
    const lvl = GAME.playerUpgrades[type];
    const price = GAME.upgradePrices[type][lvl];

    if (GAME.credits >= price && lvl < 5) {
        GAME.credits -= price;
        GAME.playerUpgrades[type]++;
        if (typeof SFX !== "undefined") SFX.play("powerUp"); // Reuse powerup sound for purchase
        updateShopUI();
    }
}

function buyAmmo(idx, isRefill) {
    const price = isRefill ? GAME.ammoPrices.refill[idx] : GAME.ammoPrices.unlock[idx];

    if (GAME.credits >= price) {
        GAME.credits -= price;
        if (isRefill) {
            player.ammoCounts[idx] += 5;
        } else {
            GAME.ammoUnlocked[idx] = true;
        }
        if (typeof SFX !== "undefined") SFX.play("powerUp");
        updateShopUI();
    }
}

// ── CUSTOMIZATION LOGIC ──────────────────────────────────────────────────

function cyclePart(type, dir) {
    if (type) {
        // Find how many items are in this category 
        const categoryMap = { turret: "turrets", body: "bodies", tracks: "tracks" };
        const category = categoryMap[type];
        const list = GAME.customParts[category];

        // Cycle index
        GAME.customParts.indices[type] = (GAME.customParts.indices[type] + dir + list.length) % list.length;

        // Update selection UI text
        const nameEl = document.getElementById(type + "Name");
        if (nameEl) nameEl.textContent = list[GAME.customParts.indices[type]].name;
    } else {
        // Initial call - refresh all text
        ["turret", "body", "tracks"].forEach(t => {
            const cat = t === "turret" ? "turrets" : (t === "body" ? "bodies" : "tracks");
            const list = GAME.customParts[cat];
            const nameEl = document.getElementById(t + "Name");
            if (nameEl) nameEl.textContent = list[GAME.customParts.indices[t]].name;
        });
    }

    // Apply parts to player
    player.customParts = {
        turret: GAME.customParts.turrets[GAME.customParts.indices.turret].key,
        body: GAME.customParts.bodies[GAME.customParts.indices.body].key,
        tracks: GAME.customParts.tracks[GAME.customParts.indices.tracks].key
    };
    player.isCustom = true;

    updateCustomPreview();
    if (typeof SFX !== "undefined" && dir !== 0) SFX.play("tankLanding", 0.4);
}

function updateCustomPreview() {
    const canvas = document.getElementById("customPreview");
    if (!canvas) return;
    const pctx = canvas.getContext("2d");

    const W = canvas.width;   // 640
    const H = canvas.height;  // 320

    pctx.clearRect(0, 0, W, H);

    const parts = player.customParts;
    const tracksImg = IMAGES[parts.tracks];
    const turretImg = IMAGES[parts.turret];
    const bodyImg = IMAGES[parts.body];

    if (!tracksImg && !turretImg && !bodyImg) {
        pctx.fillStyle = "rgba(255,255,255,0.15)";
        pctx.font = "bold 26px 'Orbitron', sans-serif";
        pctx.textAlign = "center";
        pctx.textBaseline = "middle";
        pctx.fillText("LOADING…", W / 2, H / 2);
        return;
    }

    const cx = W / 2;
    const cy = H / 2 + 10;
    const SCALE = 3.5;   // Increased to maximize vertical presence without cropping

    pctx.save();
    pctx.imageSmoothingEnabled = true;
    pctx.imageSmoothingQuality = "high";
    pctx.translate(cx, cy);
    pctx.scale(SCALE, SCALE);

    // 1. Tracks (Rendered lowest, pushed down physically so they aren't hidden behind body)
    if (tracksImg && tracksImg.complete && tracksImg.naturalWidth > 0) {
        pctx.drawImage(tracksImg, -tracksImg.naturalWidth / 2, -tracksImg.naturalHeight / 2 + 18);
    }

    // 2. Turret (Rendered behind the body)
    if (turretImg && turretImg.complete && turretImg.naturalWidth > 0) {
        pctx.drawImage(turretImg, 0, -turretImg.naturalHeight / 2 - 16);
    }

    // 3. Body (Rendered on top of everything)
    if (bodyImg && bodyImg.complete && bodyImg.naturalWidth > 0) {
        pctx.drawImage(bodyImg, -bodyImg.naturalWidth / 2, -bodyImg.naturalHeight / 2 - 6);
    }

    pctx.restore();

    // Floor shadow highlight
    pctx.save();
    pctx.globalAlpha = 0.18;
    pctx.fillStyle = "#000";
    pctx.beginPath();
    pctx.ellipse(cx, cy + 170, 65, 13, 0, 0, Math.PI * 2);
    pctx.fill();
    pctx.restore();
}

// ── BOOT ──
preloadImages(SOURCES, () => {
    showTitleScreen();
    requestAnimationFrame(gameLoop);
});