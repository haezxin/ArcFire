const canvas = document.getElementById("game");

// Keep internal resolution fixed for game logic
canvas.width = 1200; // Fixed high-res width
canvas.height = 600; // Fixed high-res height

const ctx = canvas.getContext("2d");

const GAME = {
    width: canvas.width,
    height: canvas.height,
    gravity: 0.16,
    wind: 0,
    groundBase: 430,
    leftBound: 50,
    rightBound: canvas.width - 50,
    state: "title",
    turn: "player",
    winner: null,
    lastTime: 0,
    flashTimer: 0,
    screenShake: 0,
    titleTimer: 0,              // For "Press Any Key" pulse effect
    terrain: [],
    stars: [],
    clouds: [],
    effects: [],
    projectiles: [],
    debris: [],
    obstacles: [],
    powerUps: [],
    difficulty: 1,
    // NEW fields
    round: 1,
    playerScore: 0,
    enemyScore: 0,
    difficultyMode: "normal",   // "easy" | "normal" | "hard"
    paused: false,
    playerShots: 0,
    playerHits: 0,
    playerDamageDealt: 0,
    playerConsecutiveHits: 0,
    enemyShots: 0,
    enemyHits: 0,
    enemyDamageDealt: 0,
    enemyConsecutiveHits: 0,
    shotHitThisTurn: false,
    showHint: true,
    hintTimer: 6,               // seconds to show first-turn hint
    playerPowerUp: null,        // "size" | "missile" | null
    craters: [],                // Dynamic crater images on terrain
    burnZones: [],             // Napalm burn areas (tick by turns)
    comboPopup: null,
    level: 1,                   // Current stage layout
    theme: "bright",            // "bright" | "pale"
    killedEnemies: 0,           // Number of enemies killed in Endless mode
    ammoTypes: ["Standard", "Cluster", "Oil", "Napalm"],
    credits: 0,                 // Currency for shop
    ammoUnlocked: [true, false, false, false], // Unlock status for each ammo type
    playerUpgrades: {
        armor: 0,               // Reduces damage taken
        pointer: 0              // Improves trajectory aid
    },
    ammoPrices: {
        unlock: [0, 800, 1200, 1500],
        refill: [0, 400, 600, 750]
    },
    // ── Interchangeable Tank Parts
    customParts: {
        turrets: [
            { name: "SLIM T1", key: "turret_1" },
            { name: "HEAVY T2", key: "turret_2" },
            { name: "COMMANDO", key: "turret_3" },
            { name: "SCOUT T4", key: "turret_4" }
        ],
        bodies: [
            { name: "GREEN STRIKER", key: "body_green_1" },
            { name: "GREEN HULL V2", key: "body_green_2" },
            { name: "GREEN B3", key: "body_green_3" },
            { name: "GREEN B4", key: "body_green_4" },
            { name: "GREEN B5", key: "body_green_5" },
            { name: "DESERT HULL 1", key: "body_red_1" },
            { name: "DESERT HULL 2", key: "body_red_2" },
            { name: "DESERT HULL 3", key: "body_red_3" },
            { name: "DESERT HULL 4", key: "body_red_4" },
            { name: "DESERT HULL 5", key: "body_red_5" },
            { name: "URBAN GREY 1", key: "body_grey_1" },
            { name: "URBAN GREY 2", key: "body_grey_2" },
            { name: "URBAN GREY 3", key: "body_grey_3" },
            { name: "URBAN GREY 4", key: "body_grey_4" },
            { name: "URBAN GREY 5", key: "body_grey_5" },
            { name: "NAVY HULL 1", key: "body_navy_1" },
            { name: "NAVY HULL 2", key: "body_navy_2" },
            { name: "NAVY HULL 3", key: "body_navy_3" },
            { name: "NAVY HULL 4", key: "body_navy_4" },
            { name: "NAVY HULL 5", key: "body_navy_5" }
        ],
        tracks: [
            { name: "STANDARD", key: "tracks_1" },
            { name: "REINFORCED", key: "tracks_2" },
            { name: "HEAVY T3", key: "tracks_3" },
            { name: "LIGHT T4", key: "tracks_4" },
            { name: "WIDE T5", key: "tracks_5" },
            { name: "DUAL T6", key: "tracks_6" },
            { name: "COMPACT", key: "tracks_7" }
        ],
        // Default selections
        indices: { turret: 0, body: 0, tracks: 0 }
    },

    upgradePrices: {
        armor: [200, 450, 800, 1200, 2000],
        pointer: [150, 350, 650, 1000, 1600]
    }
};

const keys = Object.create(null);

const IMAGES = {};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

// Decoration layers per war zone / theme
const WAR_DECOR = {
    1: ["dec_war1_h1", "dec_war1_h2", "dec_war1_h3"],
    2: ["dec_war2_h1", "dec_war2_h2", "dec_war2_h3", "dec_war2_h4"],
    3: ["dec_war3_h2", "dec_war3_trees"],
    4: ["dec_war4_h1", "dec_war4_h2"],
};
