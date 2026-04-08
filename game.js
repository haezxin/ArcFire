// ── ArcFire Main entry point ────────────────────────────────────────────────

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

    const wheels = ["dec_war4_wheels1", "dec_war4_wheels2", "dec_war4_wheels3"];
    const barrels = ["obs_barrel_red", "obs_barrel_green", "obs_barrel_grey"];
    const crates = ["obs_crate_wood", "obs_crate_armor", "obs_crate_repair", "obs_crate_ammo"];
    
    const WAR_OBSTACLES = { 1: wheels, 2: wheels, 3: wheels, 4: wheels };

    const lv = Math.min(GAME.level, 4);
    const obsList = [...WAR_OBSTACLES[lv] || [], ...barrels, ...crates];

    GAME.obstacles = [];
    let numObstacles = Math.floor(Math.random() * 3) + 1 + Math.floor(GAME.difficulty / 2);
    for (let i = 0; i < numObstacles; i++) {
        let ox = 250 + Math.random() * 600;
        let hp = 80 + (GAME.difficulty - 1) * 20;

        let obsType = "image";
        let ow = 50;
        let oh = 60;
        let imgKey = null;

        if (obsList.length > 0) {
            const baseKey = obsList[Math.floor(Math.random() * obsList.length)];
            let attemptKey = baseKey;
            
            // Add theme suffix for wheel obstacles only
            if (baseKey.startsWith("dec_war4_wheels")) {
                attemptKey = `${baseKey}_${GAME.theme}`;
            }
            
            // Check if image exists and load it
            const img = IMAGES[attemptKey];
            if (img && img.complete && img.naturalWidth > 0) {
                imgKey = attemptKey;
                obsType = "image";
                
                // Scale based on image dimensions
                const maxDim = 60 + Math.random() * 30;
                const scale = maxDim / Math.max(img.naturalWidth, img.naturalHeight);
                ow = img.naturalWidth * scale;
                oh = img.naturalHeight * scale;
            } else {
                // Fallback: use procedural shapes if image not loaded
                obsType = Math.random() > 0.5 ? "bunker" : "rockwall";
                ow = 36 + Math.random() * 16;
                oh = 40 + Math.random() * 30;
                imgKey = null;
            }
        }

        GAME.obstacles.push({
            x: ox, y: undefined, width: ow, height: oh,
            type: obsType, imgKey: imgKey, hp: hp, maxHp: hp, alive: true
        });
    }

    const windMax = GAME.difficultyMode === "easy" ? 0.045 : (GAME.difficultyMode === "hard" ? 0.16 : 0.09);
    GAME.wind = (Math.random() * 2 - 1) * windMax;

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
    enemy.x = 700 + Math.random() * 350; // Spawn on the right half
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