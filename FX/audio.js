// ── ArcFire Audio Manager ──────────────────────────────────────────────────
// Loads and plays the five SFX files from the FX folder.
// Accessible globally via window.SFX.play(name).

const SFX = (() => {
    const BASE = "FX/";

    const FILES = {
        cannon:       "tankCannonFX.mp3",
        missile:      "missileFX.mp3",
        shellHit:     "shellHitFX.mp3",
        tankDestroyed:"tankDestroyedFX.mp3",
        powerUp:      "powerUpsFX.mp3",
    };

    // Buffer pool per sound (max 4 concurrent instances each)
    const POOL_SIZE = 4;
    const pools = {};

    // Initialise pools on first interaction (deferred to satisfy autoplay policy)
    let ready = false;
    function init() {
        if (ready) return;
        ready = true;
        for (const [key, file] of Object.entries(FILES)) {
            pools[key] = [];
            for (let i = 0; i < POOL_SIZE; i++) {
                const audio = new Audio(BASE + file);
                audio.preload = "auto";
                pools[key].push(audio);
            }
        }
    }

    // Kick off loading on first user gesture so audio is ready when needed
    document.addEventListener("click",     init, { once: true });
    document.addEventListener("keydown",   init, { once: true });
    document.addEventListener("touchstart",init, { once: true });

    /**
     * play(name, volume?)
     *   name   – one of "cannon" | "missile" | "shellHit" | "tankDestroyed" | "powerUp"
     *   volume – 0.0 – 1.0 (default 1.0)
     */
    function play(name, volume = 1.0) {
        if (!ready) init();           // lazy init as fallback
        const pool = pools[name];
        if (!pool) { console.warn("SFX: unknown sound:", name); return; }

        // Find a stopped instance to reuse; fall back to the oldest one
        let clip = pool.find(a => a.paused || a.ended);
        if (!clip) {
            clip = pool[0];
            clip.pause();
            clip.currentTime = 0;
        }

        clip.volume = Math.max(0, Math.min(1, volume));
        clip.currentTime = 0;
        clip.play().catch(() => {}); // Swallow NotAllowedError safely
    }

    return { play, init };
})();
