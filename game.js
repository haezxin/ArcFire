const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
    playerHpBar: document.getElementById("playerHpBar"),
    enemyHpBar: document.getElementById("enemyHpBar"),
    playerHpText: document.getElementById("playerHpText"),
    enemyHpText: document.getElementById("enemyHpText"),
    powerText: document.getElementById("powerText"),
    enemyPowerText: document.getElementById("enemyPowerText"),
    playerAngleText: document.getElementById("playerAngleText"),
    enemyAngleText: document.getElementById("enemyAngleText"),
    turnIndicator: document.getElementById("turnIndicator")
};

const GAME = {
    width: canvas.width,
    height: canvas.height,
    gravity: 0.16,
    wind: 0,
    groundBase: 430,
    leftBound: 50,
    rightBound: canvas.width - 50,
    state: "aiming",
    turn: "player",
    winner: null,
    lastTime: 0,
    flashTimer: 0,
    screenShake: 0,
    terrain: [],
    stars: [],
    clouds: [],
    effects: [],
    projectile: null,
    debris: [],
    obstacles: [],
    powerUps: [],
    difficulty: 1
};

const keys = Object.create(null);

const IMAGES = {};
const SOURCES = {
    blue_idle_left: "bluetank/tank_left.png",
    blue_idle_right: "bluetank/tankblue.png",
    blue_move_left: "bluetank/left_move_blue-Sheet.png",
    blue_move_right: "bluetank/right_move_blue-Sheet.png",
    blue_fire_left: "bluetank/left_fire_blue-Sheet.png",
    blue_fire_right: "bluetank/right_fire_blue-Sheet.png",
    blue_explode_left: "bluetank/left_explode_blue-Sheet.png",
    blue_explode_right: "bluetank/right_explode_blue-Sheet.png",

    red_idle_left: "redtank/tank_red_left.png",
    red_idle_right: "redtank/tank_red_right.png",
    red_move_left: "redtank/left_move_Red-Sheet.png",
    red_move_right: "redtank/right_move_red-Sheet.png",
    red_fire_left: "redtank/left_fire_red-Sheet.png",
    red_fire_right: "redtank/right_fire_red-Sheet.png",
    red_explode_left: "redtank/left_explode_red-Sheet.png",
    red_explode_right: "redtank/right_explode_red-Sheet.png",

    bg_war1_bright: "War1/Bright/War.png",
    bg_war1_pale: "War1/Pale/War.png",
    bg_war2_bright: "War2/Bright/War2.png",
    bg_war2_pale: "War2/Pale/War2.png",
    bg_war3_bright: "War3/Bright/War3.png",
    bg_war3_pale: "War3/Pale/War3.png",
    bg_war4_bright: "War4/Bright/War4.png",
    bg_war4_pale: "War4/Pale/War4.png",

    plat_war1_bright: "War1/Bright/road.png",
    plat_war1_pale: "War1/Pale/road.png",
    plat_war2_bright: "War2/Bright/road.png",
    plat_war2_pale: "War2/Pale/road.png",
    plat_war3_bright: "War3/Bright/road.png",
    plat_war3_pale: "War3/Pale/road.png",
    plat_war4_bright: "War4/Bright/road.png",
    plat_war4_pale: "War4/Pale/road.png",
    size_power_up: "powerups/targetSize.png",
    missile1: "powerups/missile1.png",
    missile2: "powerups/missile2.png"
};

function preloadImages(sources, callback) {
    let loaded = 0;
    let total = Object.keys(sources).length;
    for (let key in sources) {
        let img = new Image();
        img.onload = () => {
            loaded++;
            if (loaded === total && callback) callback();
        };
        img.src = sources[key];
        IMAGES[key] = img;
    }
}

class Tank {
    constructor(x, color, facing, name) {
        this.x = x;
        this.color = color;
        this.facing = facing;
        this.name = name;
        this.width = 72;
        this.height = 32;
        this.hp = 100;
        this.maxHp = 100;
        this.angle = facing === 1 ? -32 : -148;
        this.power = 55;
        this.trackFrame = 0;
        this.bob = 0;
        this.hitFlash = 0;
        this.alive = true;
        this.state = "idle";
        this.animTimer = 0;
        this.animFrame = 0;
        this.scale = 1.0;
        this.effectTurns = 0;
        this.hasHomingMissile = false;
    }

    get y() {
        return getTerrainY(this.x);
    }

    muzzlePoint() {
        const angle = getTerrainAngle(this.x);
        const turretOffY = -38;
        const turretOffX = 0;

        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        const rotatedTurretX = this.x + (turretOffX * cosA - (turretOffY * this.scale) * sinA);
        const rotatedTurretY = this.y + (turretOffX * sinA + (turretOffY * this.scale) * cosA);

        const rad = this.angle * Math.PI / 180;
        const len = 48 * this.scale;
        return {
            x: rotatedTurretX + Math.cos(rad) * len,
            y: rotatedTurretY + Math.sin(rad) * len
        };
    }
}

const player = new Tank(120, "green", 1, "Player");
const enemy = new Tank(980, "red", -1, "Enemy");

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function createTerrain() {
    GAME.terrain.length = 0;
    let key = `plat_war${GAME.level}_${GAME.theme}`;
    let img = IMAGES[key];

    GAME.terrainCanvas = document.createElement("canvas");
    GAME.terrainCanvas.width = GAME.width;
    GAME.terrainCanvas.height = GAME.height;
    let tctx = GAME.terrainCanvas.getContext("2d");

    let fallback = () => {
        let seed = Math.random() * 1000;
        let diffBump = Math.min((GAME.difficulty - 1) * 25, 150);
        let hillHeight = 60 + Math.random() * 80 + diffBump;
        for (let x = 0; x <= GAME.width; x += 4) {
            let y = 450 + Math.sin(x / 150 + seed) * hillHeight + Math.sin(x / 50 + seed) * 15;
            if (x < 200) y = y * (x / 200) + 400 * (1 - x / 200);
            if (x > GAME.width - 200) y = y * ((GAME.width - x) / 200) + 400 * (1 - (GAME.width - x) / 200);
            GAME.terrain.push({ x, y: y });
        }

        let r = 20 + Math.floor(Math.random() * 40);
        let g = 30 + Math.floor(Math.random() * 60);
        let b = 25 + Math.floor(Math.random() * 30);

        tctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.94)`;
        tctx.beginPath();
        tctx.moveTo(0, GAME.height);
        for (let p of GAME.terrain) tctx.lineTo(p.x, p.y);
        tctx.lineTo(GAME.width, GAME.height);
        tctx.closePath();
        tctx.fill();

        tctx.lineWidth = 12;
        tctx.strokeStyle = `rgba(${r + 30}, ${g + 40}, ${b + 30}, 0.8)`;
        tctx.beginPath();
        tctx.moveTo(GAME.terrain[0].x, GAME.terrain[0].y);
        for (let p of GAME.terrain) tctx.lineTo(p.x, p.y);
        tctx.stroke();
    };

    if (img && img.complete && img.width > 0) {
        try {
            tctx.drawImage(img, 0, 0, GAME.width, GAME.height);
            let imgData = tctx.getImageData(0, 0, GAME.width, GAME.height).data;

            for (let x = 0; x <= GAME.width; x += 4) {
                let foundY = 400;
                for (let y = Math.floor(GAME.height / 2); y < GAME.height; y++) {
                    let alpha = imgData[(y * GAME.width + x) * 4 + 3];
                    if (alpha > 50) {
                        foundY = y;
                        break;
                    }
                }
                GAME.terrain.push({ x, y: foundY });
            }
        } catch (e) {
            fallback();
        }
    } else {
        fallback();
    }
}

function createSkyDecor() {
    GAME.clouds = [
        { x: 100, y: 95, w: 92, h: 36, speed: 0.06 },
        { x: 390, y: 70, w: 140, h: 44, speed: 0.04 },
        { x: 720, y: 110, w: 116, h: 34, speed: 0.05 }
    ];
}

function getTerrainY(x) {
    const clampedX = Math.max(0, Math.min(GAME.width, x));
    const index = Math.floor(clampedX / 4);
    const p1 = GAME.terrain[index] || GAME.terrain[GAME.terrain.length - 1];
    const p2 = GAME.terrain[Math.min(index + 1, GAME.terrain.length - 1)] || p1;
    const t = (clampedX - p1.x) / Math.max(1, p2.x - p1.x);
    return p1.y + (p2.y - p1.y) * t;
}

function getTerrainAngle(x) {
    const step = 20;
    const y1 = getTerrainY(x - step);
    const y2 = getTerrainY(x + step);
    return Math.atan2(y2 - y1, step * 2);
}

function carveTerrain(cx, cy, radius) {
    if (GAME.terrainCanvas) {
        let tctx = GAME.terrainCanvas.getContext("2d");
        tctx.save();
        tctx.globalCompositeOperation = "destination-out";
        tctx.beginPath();
        tctx.arc(cx, cy, radius, 0, Math.PI * 2);
        tctx.fill();
        tctx.restore();
    }

    for (let p of GAME.terrain) {
        let dx = p.x - cx;
        if (Math.abs(dx) < radius) {
            let dy = Math.sqrt(radius * radius - dx * dx);
            let craterBot = cy + dy;
            if (p.y < craterBot) {
                p.y = Math.min(GAME.height, craterBot);
            }
        }
    }
}

function checkObstacleHit(projectile) {
    for (let obs of GAME.obstacles) {
        if (!obs.alive) continue;
        let oy = obs.y !== undefined ? obs.y : getTerrainY(obs.x);
        if (projectile.x > obs.x - obs.width / 2 && projectile.x < obs.x + obs.width / 2 &&
            projectile.y > oy - obs.height && projectile.y < oy) {
            return obs;
        }
    }
    return null;
}

function resetGame() {
    createTerrain();
    createSkyDecor();

    GAME.effects = [];
    GAME.debris = [];
    GAME.projectile = null;
    GAME.state = "aiming";
    GAME.turn = "player";
    GAME.winner = null;
    GAME.flashTimer = 0;
    GAME.screenShake = 0;
    GAME.powerUps = [];

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

    GAME.obstacles = [];
    let numObstacles = Math.floor(Math.random() * 3) + 1 + Math.floor(GAME.difficulty / 2);
    for (let i = 0; i < numObstacles; i++) {
        let ox = 250 + Math.random() * 600;
        let ow = 36 + Math.random() * 16;
        let oh = 40 + Math.random() * 30;
        let hp = 80 + (GAME.difficulty - 1) * 20;
        GAME.obstacles.push({
            x: ox,
            y: undefined,
            width: ow,
            height: oh,
            type: Math.random() > 0.5 ? "bunker" : "rockwall",
            hp: hp,
            maxHp: hp,
            alive: true
        });
    }

    updateUI();
}

function updateUI() {
    ui.playerHpBar.style.width = `${player.hp}%`;
    ui.enemyHpBar.style.width = `${enemy.hp}%`;
    ui.playerHpText.textContent = `${Math.max(0, Math.round(player.hp))} / ${player.maxHp}`;
    ui.enemyHpText.textContent = `${Math.max(0, Math.round(enemy.hp))} / ${enemy.maxHp}`;

    if (ui.powerText) ui.powerText.textContent = `${Math.round(player.power)}%`;
    if (ui.enemyPowerText) ui.enemyPowerText.textContent = `${Math.round(enemy.power)}%`;
    if (ui.playerAngleText) ui.playerAngleText.textContent = `${Math.round(-player.angle)}°`;
    if (ui.enemyAngleText) ui.enemyAngleText.textContent = `${Math.round(enemy.angle + 180)}°`;

    if (ui.turnIndicator) {
        ui.turnIndicator.textContent = GAME.turn === "player" ? "YOUR TURN" : "ENEMY TURN";
        ui.turnIndicator.style.color = GAME.turn === "player" ? "var(--success)" : "var(--danger)";
    }
}

function spawnProjectile(tank, isHoming = false) {
    const angle = tank.angle * Math.PI / 180;
    const power = tank.power * 0.165;
    const muzzle = tank.muzzlePoint(); // Keep as function call

    GAME.projectile = {
        owner: tank.name, // Keep owner
        x: muzzle.x,
        y: muzzle.y,
        vx: Math.cos(angle) * power,
        vy: Math.sin(angle) * power,
        radius: 5, // Keep radius
        trail: [],
        homing: isHoming,
        animTimer: 0,
        shooter: tank
    };

    GAME.effects.push({
        type: "muzzle",
        x: muzzle.x,
        y: muzzle.y,
        angle: angle, // Use 'angle' here
        timer: 0.16,
        max: 0.16
    });

    GAME.flashTimer = 0.05;
    GAME.state = "projectile";

    tank.state = "firing";
    tank.animFrame = 0;
    tank.animTimer = 0;
}

function fireCurrentTank() {
    if (GAME.projectile || GAME.winner) return;

    if (GAME.turn === "player") {
        spawnProjectile(player);
    } else {
        spawnProjectile(enemy);
    }
}

function solveBallisticEstimate(dxAbs, dy, launchDegrees, gravity) {
    const theta = launchDegrees * Math.PI / 180;
    const denom = 2 * Math.pow(Math.cos(theta), 2) * (dxAbs * Math.tan(theta) - dy);
    if (denom <= 0) return null;
    return Math.sqrt((gravity * dxAbs * dxAbs) / denom);
}

function applyAIShot() {
    if (GAME.turn !== "enemy" || GAME.state !== "aiming" || GAME.winner) return;

    const dx = player.x - enemy.x;
    const dy = (player.y - 24) - (enemy.y - 24);
    const distance = Math.abs(dx);

    let angleDeg = -145;
    let power = clamp(42 + distance * 0.04, 28, 92);

    const arcChoice = distance > 420 ? 50 : 38;
    angleDeg = -180 + arcChoice;

    const rough = solveBallisticEstimate(distance, dy, arcChoice, GAME.gravity);
    if (rough) {
        power = clamp(rough * 3.55, 25, 95);
    }

    angleDeg += Math.random() * 3 - 1.5;
    power += Math.random() * 2 - 1;

    enemy.angle = clamp(angleDeg, -210, -10);
    enemy.power = clamp(power, 20, 100);

    setTimeout(() => {
        if (!GAME.winner && GAME.turn === "enemy" && GAME.state === "aiming") {
            fireCurrentTank();
        }
    }, 850);
}

function updatePlayerInput(dt) {
    if (GAME.state === "intro" || GAME.turn !== "player" || GAME.state !== "aiming" || GAME.winner) return;

    const moveSpeed = 86;
    let moved = false;

    let minX = GAME.leftBound;
    let maxX = enemy.x - 150;
    GAME.obstacles.forEach(obs => {
        if (!obs.alive) return;
        if (obs.x > player.x) maxX = Math.min(maxX, obs.x - obs.width / 2 - 42);
        else minX = Math.max(minX, obs.x + obs.width / 2 + 42);
    });

    if (keys["a"]) {
        player.x = clamp(player.x - moveSpeed * dt, minX, maxX);
        moved = true;
    }
    if (keys["d"]) {
        player.x = clamp(player.x + moveSpeed * dt, minX, maxX);
        moved = true;
    }
    if (keys["arrowup"]) player.angle = clamp(player.angle - 48 * dt, -170, 30);
    if (keys["arrowdown"]) player.angle = clamp(player.angle + 48 * dt, -170, 30);
    if (keys["arrowleft"]) player.power = clamp(player.power - 34 * dt, 20, 100);
    if (keys["arrowright"]) player.power = clamp(player.power + 34 * dt, 20, 100);

    if (moved) {
        if (player.state !== "firing" && player.alive) {
            player.state = "moving";
        }
        player.trackFrame += dt * 12;
        player.bob += dt * 10;
    } else {
        if (player.state === "moving") {
            player.state = "idle";
        }
    }

    updateUI();
}

function updateProjectile(dt) {
    if (!GAME.projectile) return;

    const p = GAME.projectile;

    p.trail.push({ x: p.x, y: p.y, life: 0.5 });
    if (p.trail.length > 18) p.trail.shift();

    p.x += p.vx;
    p.y += p.vy;
    p.vy += GAME.gravity;
    p.vx += GAME.wind;

    if (p.homing) {
        const target = p.shooter === player ? enemy : player;
        const tx = target.x;
        const ty = target.y - 24 * target.scale;
        const dx = tx - p.x;
        const dy = ty - p.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 5) {
            const steerSpeed = 0.45;
            const desiredVx = (dx / dist) * 12;
            const desiredVy = (dy / dist) * 12;
            p.vx += (desiredVx - p.vx) * steerSpeed;
            p.vy += (desiredVy - p.vy) * steerSpeed;
        }
        p.animTimer += dt * 15;
    }

    for (const t of p.trail) t.life -= dt;
    p.trail = p.trail.filter(t => t.life > 0);

    const terrainY = getTerrainY(p.x);

    if (p.x < -20 || p.x > GAME.width + 20 || p.y > GAME.height + 30) {
        GAME.projectile = null;
        endTurn();
        return;
    }

    if (p.y >= terrainY - 2) {
        explode(p.x, terrainY - 2, 42, null);
        GAME.projectile = null;
        endTurn();
        return;
    }

    const hitTank = checkTankHit(p, player) || checkTankHit(p, enemy);
    if (hitTank) {
        explode(p.x, p.y, 48, hitTank);
        GAME.projectile = null;
        endTurn();
        return;
    }

    const hitObs = checkObstacleHit(p);
    if (hitObs) {
        explode(p.x, p.y, 42, null);
        GAME.projectile = null;
        endTurn();
        return;
    }
}

function checkTankHit(projectile, tank) {
    if (!tank.alive) return null;

    const angle = getTerrainAngle(tank.x);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const dx = projectile.x - tank.x;
    const dy = projectile.y - tank.y;

    const lx = dx * cosA + dy * sinA;
    const ly = -dx * sinA + dy * cosA;

    const hitW = 64 * tank.scale;
    const hitH = 42 * tank.scale;

    const inRect = Math.abs(lx) < hitW / 2 && ly < 0 && ly > -hitH;

    return inRect ? tank : null;
}

function applyDamage(tank, amount) {
    if (!tank.alive) return;

    tank.hp = clamp(tank.hp - amount, 0, tank.maxHp);
    tank.hitFlash = 0.18;

    if (tank.hp <= 0) {
        if (tank.alive) {
            tank.state = "exploding";
            tank.animFrame = 0;
            tank.animTimer = 0;
        }
        tank.alive = false;
        tank.hp = 0;
        GAME.effects.push({
            type: "bigExplosion",
            x: tank.x,
            y: tank.y - 28,
            radius: 72,
            timer: 0.9,
            max: 0.9
        });
        GAME.winner = tank === player ? "Enemy Wins!" : "Player Wins!";
        GAME.state = "gameover";
        setTimeout(() => {
            document.getElementById("gameOverTitle").textContent = GAME.winner === "Player Wins!" ? "VICTORY" : "DEFEAT";
            document.getElementById("gameOverTitle").style.color = GAME.winner === "Player Wins!" ? "var(--success)" : "var(--danger)";
            document.getElementById("gameOverDesc").textContent = GAME.winner === "Player Wins!" ? "Enemy tank eliminated." : "Your tank was destroyed.";
            document.getElementById("nextLevelBtn").style.display = GAME.winner === "Player Wins!" ? "inline-block" : "none";
            document.getElementById("gameOverScreen").classList.remove("hidden");
        }, 1500);
    }
}

function explode(x, y, radius, directTank) {
    carveTerrain(x, y, Math.max(radius, 42));
    GAME.screenShake = Math.max(GAME.screenShake, 8);

    GAME.effects.push({
        type: "explosion",
        x,
        y,
        radius,
        timer: 0.55,
        max: 0.55
    });

    GAME.effects.push({
        type: "smoke",
        x,
        y,
        timer: 1.1,
        max: 1.1,
        radius: radius * 0.8
    });

    for (let i = 0; i < 12; i++) {
        GAME.debris.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 5,
            vy: -Math.random() * 4 - 1,
            size: 2 + Math.random() * 3,
            life: 0.9 + Math.random() * 0.4
        });
    }

    [player, enemy].forEach(tank => {
        const angle = getTerrainAngle(tank.x);
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const dx = x - tank.x;
        const dy = y - tank.y;
        const lx = dx * cosA + dy * sinA;
        const ly = -dx * sinA + dy * cosA;

        const tx = tank.x + (0 * cosA - (-24) * sinA);
        const ty = tank.y + (0 * sinA + (-24 * tank.scale) * cosA);
        const dist = Math.hypot(tx - x, ty - y);

        if (dist <= radius + 36 * tank.scale) {
            const damage = Math.max(10, Math.round(38 - dist * 0.38));
            applyDamage(tank, damage);
        }
    });

    GAME.obstacles.forEach(obs => {
        if (!obs.alive) return;
        let oy = obs.y !== undefined ? obs.y : getTerrainY(obs.x);
        const dist = Math.hypot(obs.x - x, (oy - obs.height / 2) - y);
        if (dist <= radius + Math.max(obs.width, obs.height) / 2 + 10) {
            const damage = Math.max(15, Math.round(50 - dist * 0.45));
            obs.hp -= damage;
            if (obs.hp <= 0) obs.alive = false;
        }
    });

    if (directTank) applyDamage(directTank, 8);
    updateUI();
}

function endTurn() {
    if (GAME.winner) return;

    GAME.state = "aiming";
    GAME.turn = GAME.turn === "player" ? "enemy" : "player";

    [player, enemy].forEach(tank => {
        if (tank.effectTurns > 0) {
            tank.effectTurns--;
            if (tank.effectTurns <= 0) {
                tank.scale = 1.0;
            }
        }
    });

    if (Math.random() < 0.1) {
        const rVal = Math.random();
        const type = rVal < 0.33 ? "size" : (rVal < 0.66 ? "grow" : "missile");
        const x = 200 + Math.random() * (GAME.width - 400);
        GAME.powerUps.push({
            x,
            y: getTerrainY(x),
            type: type,
            pickedUp: false,
            bob: 0
        });
    }

    if (GAME.turn === "enemy") {
        GAME.state = "moving";
        const dir = Math.random() < 0.5 ? -1 : 1;
        const dist = 40 + Math.random() * 80;
        enemy.targetX = clamp(enemy.x + dir * dist, player.x + 150, GAME.rightBound);
    }
    updateUI();
}

function updateEffects(dt) {
    GAME.effects.forEach(effect => effect.timer -= dt);
    GAME.effects = GAME.effects.filter(effect => effect.timer > 0);

    GAME.debris.forEach(d => {
        d.x += d.vx;
        d.y += d.vy;
        d.vy += 0.12;
        d.life -= dt;
    });

    GAME.debris = GAME.debris.filter(d => d.life > 0 && d.y < GAME.height + 30);

    [player, enemy].forEach(tank => {
        tank.hitFlash = Math.max(0, tank.hitFlash - dt);

        let prefix = tank.color === "green" ? "blue" : "red";
        let dir = tank.facing === 1 ? "right" : "left";

        if (tank.state === "moving" && tank.alive) {
            tank.animTimer += dt * 10;
            if (tank.animTimer > 1) {
                tank.animTimer = 0;
                tank.animFrame++;
            }
        } else if (tank.state === "firing") {
            tank.animTimer += dt * 15;
            if (tank.animTimer > 1) {
                tank.animTimer = 0;
                tank.animFrame++;
                let key = `${prefix}_fire_${dir}`;
                let img = IMAGES[key];
                let frames = img ? Math.floor(img.width / 64) * Math.floor(img.height / 64) : 12;
                if (!frames || frames <= 0) frames = 1;

                if (tank.animFrame >= frames) {
                    tank.state = "idle";
                }
            }
        } else if (tank.state === "exploding") {
            tank.animTimer += dt * 10;
            if (tank.animTimer > 1) {
                tank.animTimer = 0;
                tank.animFrame++;
                let key = `${prefix}_explode_${dir}`;
                let img = IMAGES[key];
                let frames = img ? Math.floor(img.width / 64) * Math.floor(img.height / 64) : 12;
                if (!frames || frames <= 0) frames = 1;

                if (tank.animFrame >= frames - 1) {
                    tank.animFrame = frames - 1;
                }
            }
        }
    });

    GAME.flashTimer = Math.max(0, GAME.flashTimer - dt);
    GAME.screenShake = Math.max(0, GAME.screenShake - dt * 20);
}

function drawCloud(x, y, w, h) {
    ctx.beginPath();
    ctx.arc(x, y, h * 0.42, 0, Math.PI * 2);
    ctx.arc(x + w * 0.22, y - h * 0.16, h * 0.5, 0, Math.PI * 2);
    ctx.arc(x + w * 0.48, y - h * 0.1, h * 0.58, 0, Math.PI * 2);
    ctx.arc(x + w * 0.72, y, h * 0.46, 0, Math.PI * 2);
    ctx.fill();
}

function drawBackground() {
    let key = `bg_war${GAME.level}_${GAME.theme}`;
    let img = IMAGES[key];

    if (img && img.complete && img.width > 0) {
        ctx.drawImage(img, 0, 0, GAME.width, GAME.height);
    } else {
        const grad = ctx.createLinearGradient(0, 0, 0, GAME.height);
        grad.addColorStop(0, "#2c3b4a");
        grad.addColorStop(1, "#12181f");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, GAME.width, GAME.height);
    }

    GAME.clouds.forEach(cloud => {
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        drawCloud(cloud.x, cloud.y, cloud.w, cloud.h);
    });
}

function drawBush(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#356f2d";
    ctx.beginPath();
    ctx.arc(-8, 0, 10, 0, Math.PI * 2);
    ctx.arc(2, -6, 12, 0, Math.PI * 2);
    ctx.arc(12, 1, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawRock(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#7d7f85";
    ctx.beginPath();
    ctx.moveTo(-18, 10);
    ctx.lineTo(-10, -10);
    ctx.lineTo(8, -16);
    ctx.lineTo(22, -4);
    ctx.lineTo(18, 12);
    ctx.lineTo(0, 18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.stroke();
    ctx.restore();
}

function drawTerrain() {
    if (GAME.terrainCanvas) {
        ctx.drawImage(GAME.terrainCanvas, 0, 0);
    }
}

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
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

function drawTank(tank) {
    const x = tank.x;
    const y = tank.y;
    const angle = getTerrainAngle(x);
    const flashAlpha = tank.hitFlash > 0 ? 0.45 : 0;
    const prefix = tank.color === "green" ? "blue" : "red";
    const dir = tank.facing === 1 ? "right" : "left";

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(x, y + Math.sin(tank.bob) * 0.6);
    ctx.rotate(angle);
    ctx.scale(tank.scale, tank.scale);

    let state = tank.state;
    if (!tank.alive && state !== "exploding") {
        state = "exploding";
    }

    let key = `${prefix}_${state}_${dir}`;
    if (state === "idle") key = `${prefix}_idle_${dir}`;
    else if (state === "moving") key = `${prefix}_move_${dir}`;
    else if (state === "firing") key = `${prefix}_fire_${dir}`;
    else if (state === "exploding") key = `${prefix}_explode_${dir}`;
    else key = `${prefix}_idle_${dir}`;

    let img = IMAGES[key];

    if (img && img.complete && img.width > 0) {
        if (state === "idle") {
            ctx.drawImage(img, -48, -72, 96, 96);
        } else {
            let cols = Math.floor(img.width / 64) || 1;
            let rows = Math.floor(img.height / 64) || 1;
            let totalFrames = cols * rows;

            let frame = tank.animFrame % totalFrames;
            if (state === "exploding" && tank.animFrame >= totalFrames - 1) {
                frame = totalFrames - 1;
            }
            if (state === "firing" && tank.animFrame >= totalFrames - 1) {
                frame = totalFrames - 1;
            }

            let sx = (frame % cols) * 64;
            let sy = Math.floor(frame / cols) * 64;

            ctx.drawImage(img, sx, sy, 64, 64, -48, -72, 96, 96);
        }
    } else {

        ctx.fillStyle = tank.color;
        ctx.fillRect(-36, -30, 72, 30);
    }

    if (flashAlpha > 0) {
        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
        ctx.fillRect(-80, -80, 160, 160);
    }

    ctx.restore();
}

function drawAimGuide() {
    if (GAME.turn !== "player" || GAME.state !== "aiming" || GAME.winner) return;

    const muzzle = player.muzzlePoint();
    const rad = player.angle * Math.PI / 180;
    const preview = [];

    let x = muzzle.x;
    let y = muzzle.y;
    let vx = Math.cos(rad) * player.power * 0.28;
    let vy = Math.sin(rad) * player.power * 0.28;

    for (let i = 0; i < 28; i++) {
        x += vx;
        y += vy;
        vy += GAME.gravity;
        preview.push({ x, y });
        if (y > getTerrainY(x)) break;
    }

    ctx.save();
    for (let i = 0; i < preview.length; i++) {
        const p = preview[i];
        ctx.globalAlpha = 1 - i / preview.length;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.4 - i * 0.03, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function drawProjectile() {
    const p = GAME.projectile;
    if (!p) return;

    ctx.save();
    for (const t of p.trail) {
        ctx.globalAlpha = t.life * 0.65;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(t.x, t.y, 3.2 * t.life, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(p.x, p.y);
    const angle = Math.atan2(p.vy, p.vx);
    ctx.rotate(angle);

    if (p.homing) {
        const frame = Math.floor(p.animTimer) % 2 === 0 ? "missile1" : "missile2";
        const img = IMAGES[frame];
        if (img) {
            ctx.drawImage(img, -24, -12, 48, 24);
        } else {
            ctx.fillStyle = "#ff4444";
            ctx.fillRect(-12, -4, 24, 8);
        }
    } else {
        ctx.fillStyle = "#6b7179";
        roundRect(ctx, -8, -4, 16, 8, 3, true, false);
        ctx.fillStyle = "#c7ccd3";
        roundRect(ctx, 2, -3, 6, 6, 2, true, false);
    }
    ctx.restore();
}

function drawObstacles() {
    GAME.obstacles.forEach(obs => {
        if (!obs.alive) return;
        let oy = obs.y !== undefined ? obs.y : getTerrainY(obs.x);
        let angle = getTerrainAngle(obs.x);
        ctx.save();
        ctx.translate(obs.x, oy);
        ctx.rotate(angle);

        if (obs.type === "bunker") {
            ctx.fillStyle = "#5a5c62";
            ctx.beginPath();
            ctx.moveTo(-obs.width / 2, 0);
            ctx.lineTo(-obs.width / 2, -obs.height + 14);
            ctx.quadraticCurveTo(0, -obs.height - 10, obs.width / 2, -obs.height + 14);
            ctx.lineTo(obs.width / 2, 0);
            ctx.fill();

            ctx.lineWidth = 3;
            ctx.strokeStyle = "#38393d";
            ctx.stroke();

            ctx.fillStyle = "#111";
            ctx.fillRect(-obs.width / 4, -obs.height / 1.5, obs.width / 2, 8);
        } else {
            drawRock(0, -obs.height / 2, obs.width / 30);
        }

        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(-obs.width / 2, -obs.height - 14, obs.width, 5);
        ctx.fillStyle = "#7aff7a";
        ctx.fillRect(-obs.width / 2, -obs.height - 14, Math.max(0, obs.width * (obs.hp / obs.maxHp)), 5);
        ctx.restore();
    });
}

function drawEffects() {
    for (const effect of GAME.effects) {
        const progress = 1 - effect.timer / effect.max;

        if (effect.type === "muzzle") {
            ctx.save();
            ctx.translate(effect.x, effect.y);
            ctx.rotate(effect.angle);
            ctx.globalAlpha = 1 - progress;

            const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, 34);
            grad.addColorStop(0, "rgba(255,255,255,1)");
            grad.addColorStop(0.35, "rgba(255,235,140,0.95)");
            grad.addColorStop(1, "rgba(255,120,30,0)");

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(34, -11);
            ctx.lineTo(24, 0);
            ctx.lineTo(34, 11);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        if (effect.type === "explosion" || effect.type === "bigExplosion") {
            const scale = effect.type === "bigExplosion" ? 1.45 : 1;
            const r = effect.radius * (0.25 + progress) * scale;

            ctx.save();
            ctx.globalAlpha = 1 - progress * 0.9;
            const grad = ctx.createRadialGradient(effect.x, effect.y, 2, effect.x, effect.y, r);
            grad.addColorStop(0, "rgba(255,255,240,1)");
            grad.addColorStop(0.22, "rgba(255,223,110,0.95)");
            grad.addColorStop(0.6, "rgba(255,130,40,0.82)");
            grad.addColorStop(1, "rgba(110,30,20,0)");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        if (effect.type === "smoke") {
            ctx.save();
            ctx.globalAlpha = 0.5 * (1 - progress);
            for (let i = 0; i < 5; i++) {
                ctx.fillStyle = "rgba(80,80,80,0.7)";
                ctx.beginPath();
                ctx.arc(
                    effect.x + Math.sin(i * 1.3) * 18 * progress,
                    effect.y - 15 * progress - i * 6,
                    effect.radius * 0.18 + i * 3,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            }
            ctx.restore();
        }
    }

    GAME.debris.forEach(d => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, d.life);
        ctx.fillStyle = "#6d5233";
        ctx.fillRect(d.x, d.y, d.size, d.size);
        ctx.restore();
    });
}

function drawPanelText(x, y, text, color, size = 16) {
    ctx.fillStyle = color;
    ctx.font = `${size >= 16 ? "700" : "500"} ${size}px Arial`;
    ctx.fillText(text, x, y);
}

function drawGauge(cx, cy, radius, angleValue, min, max, color) {
    ctx.save();
    ctx.translate(cx, cy);

    ctx.strokeStyle = "rgba(10,18,26,0.85)";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(0, 0, radius, Math.PI, 0);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = 10;
    const percent = clamp((angleValue - min) / (max - min), 0, 1);
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



function updatePowerUps(dt) {
    GAME.powerUps.forEach(pu => {
        if (pu.pickedUp) return;
        pu.bob += dt * 2;

        // Keep power up on terrain if it changes (craters)
        pu.y = getTerrainY(pu.x);
        const pickupDist = 68;
        [player, enemy].forEach(tank => {
            const opponent = tank === player ? enemy : player;
            const tankCenterY = tank.y - 24 * tank.scale;
            const puCenterY = pu.y - 45;
            const dist = Math.hypot(tank.x - pu.x, tankCenterY - puCenterY);

            if (dist < pickupDist && !pu.pickedUp) {
                pu.pickedUp = true;
                if (pu.type === "size") {
                    tank.scale = 0.6;
                    tank.effectTurns = 4;
                } else if (pu.type === "grow") {
                    opponent.scale = 1.5;
                    opponent.effectTurns = 4;
                } else if (pu.type === "missile") {
                    tank.state = "firing";
                    tank.animFrame = 0;
                    spawnProjectile(tank, true);
                    updateUI();
                }

                GAME.effects.push({
                    type: "muzzle",
                    x: pu.x,
                    y: pu.y - 45,
                    angle: -Math.PI / 2,
                    timer: 0.4,
                    max: 0.4
                });
            }
        });

    });
    GAME.powerUps = GAME.powerUps.filter(pu => !pu.pickedUp);
}

function drawPowerUps() {
    GAME.powerUps.forEach(pu => {
        ctx.save(); ctx.translate(pu.x, pu.y - 45 + Math.sin(pu.bob) * 12);

        ctx.fillStyle = pu.type === "size" ? "rgba(120, 230, 255, 0.35)" : "rgba(255, 120, 255, 0.35)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
        ctx.lineWidth = 3;

        const r = 34;
        const pSize = 4;
        for (let x = -r; x <= r; x += pSize) {
            for (let y = -r; y <= r; y += pSize) {
                if (x * x + y * y <= r * r) {
                    if ((Math.abs(x) + Math.abs(y)) % (pSize * 2) === 0) {
                        ctx.fillRect(x, y, pSize, pSize);
                    }
                }
            }
        }

        ctx.beginPath();
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
            const bx = Math.round((Math.cos(a) * r) / pSize) * pSize;
            const by = Math.round((Math.sin(a) * r) / pSize) * pSize;
            if (a === 0) ctx.moveTo(bx, by);
            else ctx.lineTo(bx, by);
        }
        ctx.closePath();
        ctx.stroke();

        // Only draw the correct icon inside
        const isMissile = pu.type === "missile";
        const icon = isMissile ? IMAGES["missile1"] : IMAGES["size_power_up"];
        if (icon) {
            ctx.save();
            ctx.rotate(Math.sin(pu.bob * 0.5) * 0.15);
            if (!isMissile) {
                ctx.filter = pu.type === "size" ? "none" : "hue-rotate(120deg)";
            }
            const s = pu.type === "size" ? 42 : (isMissile ? 54 : 54);
            ctx.drawImage(icon, -s / 2, -s / 2, s, s);
            ctx.filter = "none";
            ctx.restore();
        }

        ctx.restore();

    });
}

function updateEnemyAI(dt) {
    if (GAME.turn !== "enemy" || GAME.winner) return;

    if (GAME.state === "moving") {
        let minX = player.x + 150;
        let maxX = GAME.rightBound;
        GAME.obstacles.forEach(obs => {
            if (!obs.alive) return;
            if (obs.x < enemy.x) minX = Math.max(minX, obs.x + obs.width / 2 + 42);
            else maxX = Math.min(maxX, obs.x - obs.width / 2 - 42);
        });

        enemy.targetX = clamp(enemy.targetX, minX, maxX);

        const moveSpeed = 60;
        const dx = enemy.targetX - enemy.x;

        if (Math.abs(dx) > moveSpeed * dt) {
            enemy.state = "moving";
            enemy.x = clamp(enemy.x + Math.sign(dx) * moveSpeed * dt, minX, maxX);
            enemy.trackFrame += dt * 12;
            enemy.bob += dt * 10;
        } else {
            enemy.state = "idle";
            enemy.x = enemy.targetX;
            GAME.state = "thinking";
            setTimeout(() => {
                if (!GAME.winner) {
                    GAME.state = "aiming";
                    applyAIShot();
                }
            }, 600);
        }
        updateUI();
    }
}

function update(dt) {
    if (GAME.state === "intro") return;

    updatePlayerInput(dt);
    updateProjectile(dt);
    updateEffects(dt);
    updateEnemyAI(dt);
    updatePowerUps(dt);

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
    drawAimGuide();
    drawTank(player);
    drawTank(enemy);
    drawPowerUps();
    drawObstacles();
    drawProjectile();
    drawEffects();

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

    if (e.code === "Space" || key === " ") {
        e.preventDefault();
        if (GAME.turn === "player" && GAME.state === "aiming" && !GAME.projectile && !GAME.winner) {
            fireCurrentTank();
        }
    }
});

document.addEventListener("keyup", e => {
    keys[e.key.toLowerCase()] = false;
});

function showIntro() {
    document.getElementById("introScreen").classList.remove("hidden");
    GAME.state = "intro";
}

function startGame() {
    document.getElementById("introScreen").classList.add("hidden");
    document.getElementById("gameOverScreen").classList.add("hidden");
    GAME.difficulty = 1;
    resetGame();
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

document.getElementById("menuBtn").addEventListener("click", showIntro);
document.getElementById("startBtn").addEventListener("click", startGame);
document.getElementById("nextLevelBtn").addEventListener("click", loadNextLevel);
document.getElementById("endMenuBtn").addEventListener("click", quitToMenu);

preloadImages(SOURCES, () => {
    resetGame();
    showIntro();
    requestAnimationFrame(gameLoop);
});