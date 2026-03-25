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
    player.state = "idle";
    enemy.state = "idle";
    player.animTimer = 0;
    enemy.animTimer = 0;
    player.animFrame = 0;
    enemy.animFrame = 0;
    player.scale = 1.0;
    enemy.scale = 1.0;
    player.effectTurns = 0;
    enemy.effectTurns = 0;
    player.hasHomingMissile = false;
    enemy.hasHomingMissile = false;

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
    const WAR_OBSTACLES = { 1: wheels, 2: wheels, 3: wheels, 4: wheels };

    const lv = Math.min(GAME.level, 4);
    const obsList = WAR_OBSTACLES[lv] || [];

    GAME.obstacles = [];
    let numObstacles = Math.floor(Math.random() * 3) + 1 + Math.floor(GAME.difficulty / 2);
    for (let i = 0; i < numObstacles; i++) {
        let ox = 250 + Math.random() * 600;
        let hp = 80 + (GAME.difficulty - 1) * 20;

        let obsType = Math.random() > 0.5 ? "bunker" : "rockwall";
        let ow = 36 + Math.random() * 16;
        let oh = 40 + Math.random() * 30;
        let imgKey = null;

        if (obsList.length > 0) {
            const baseKey = obsList[Math.floor(Math.random() * obsList.length)];
            const attemptKey = `${baseKey}_${GAME.theme}`;
            const croppedImg = getCroppedImage(attemptKey);

            if (croppedImg && croppedImg.width > 0) {
                imgKey = attemptKey + "_cropped";
                if (!IMAGES[imgKey]) imgKey = attemptKey; // Fallback if no crop needed
                obsType = "image";

                const maxDim = 80 + Math.random() * 50;
                const scale = maxDim / Math.max(croppedImg.width || croppedImg.naturalWidth, croppedImg.height || croppedImg.naturalHeight);
                ow = (croppedImg.width || croppedImg.naturalWidth) * scale;
                oh = (croppedImg.height || croppedImg.naturalHeight) * scale;
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
    GAME.playerPowerUp = null;
    GAME.paused = false;
    GAME.showHint = true;
    GAME.hintTimer = 6;

    updateHUD();
}

function updateHUD() {
    // HUD is now handled by drawCanvasHUD in the render loop.
}

function update(dt) {
    if (GAME.state === "intro") return;
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
    drawObstacles();
    drawTank(player);
    drawTank(enemy);

    if (GAME.state !== "intro") {
        drawAimGuide();
        drawPowerUps();
        drawProjectile();
        drawEffects();
        drawWindOverlay();
        drawHint();
        drawCanvasHUD();
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
    const key = e.key.toLowerCase();
    keys[key] = true;

    if (e.key === "Escape") {
        e.preventDefault();
        if (GAME.state === "gameover" || GAME.state === "intro") return;
        togglePause();
        return;
    }

    if (e.code === "Space" || key === " ") {
        e.preventDefault();
        if (GAME.paused) return;
        if (GAME.turn === "player" && GAME.state === "aiming" && !GAME.projectile && !GAME.winner) {
            fireCurrentTank();
        }
    }
});

document.addEventListener("keyup", e => {
    keys[e.key.toLowerCase()] = false;
});

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

    document.getElementById("introScreen").classList.add("hidden");
    document.getElementById("gameOverScreen").classList.add("hidden");
    const mBtn = document.getElementById("menuBtn");
    if (mBtn) mBtn.classList.remove("hidden");

    GAME.difficulty = 1;
    GAME.round = 1;
    GAME.playerScore = 0;
    GAME.enemyScore = 0;
    resetGame();

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
        GAME.screenShake = 2;
    });
});

// ── BOOT ──
preloadImages(SOURCES, () => {
    showIntro();
    requestAnimationFrame(gameLoop);
});