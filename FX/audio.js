// ── ArcFire Audio Manager ──────────────────────────────────────────────────
// Loads and plays the five SFX files from the FX folder.
// Accessible globally via window.SFX.play(name).

const SFX = (() => {
    const BASE = "FX/";

    const FILES = {
        cannon:       "tankCannonFX.mp3",
        missile:      "missileFX.mp3",
        shellHit:     "shellHitFX.mp3",
        oilHit:       "oilHitFX.mp3",
        napalmHit:    "napalmHitFX.mp3",
        tankDestroyed:"tankDestroyedFX.mp3",
        tankLanding:  "tankLandingFX.mp3",
        napalmBurn:   "napalmBurnFX.mp3",
        powerUp:      "powerUpsFX.mp3",
        bgm:          "BGmusic.mp3",
    };

    // Buffer pool per sound (max 4 concurrent instances each)
    const POOL_SIZE = 4;
    const pools = {};
    const loops    = Object.create(null);
    const fades    = Object.create(null); // active fade interval handles per name
    const targets  = Object.create(null); // target volume per name
    const baseVols = Object.create(null); // untracked original volume per name

    // Initialise pools on first interaction (deferred to satisfy autoplay policy)
    let ready  = false;
    let sfxVol = 1.0;
    let bgmVol = 1.0;
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
    
    // Auto-start background music on the first interaction
    document.addEventListener("click",     () => startLoop("bgm", 0.45), { once: true });
    document.addEventListener("keydown",   () => startLoop("bgm", 0.45), { once: true });
    document.addEventListener("touchstart",() => startLoop("bgm", 0.45), { once: true });

    /**
     * play(name, volume?)
     *   name   – one of "cannon" | "missile" | "shellHit" | "tankDestroyed" | "powerUp"
     *   volume – 0.0 – 1.0 (default 1.0)
     */
    function play(name, volume = 1.0) {
        if (!ready) init();           // lazy init as fallback
        const pool = pools[name];
        if (!pool) { console.warn("SFX: unknown sound:", name); return; }

        // Find a stopped instance to reuse;
        // if all are still playing, spawn a throwaway instance so nothing gets cut off.
        let clip = pool.find(a => a.paused || a.ended);
        if (!clip) {
            clip = new Audio(BASE + FILES[name]);
            clip.preload = "auto";
        }

        clip.volume = Math.max(0, Math.min(1, volume * sfxVol));
        clip.currentTime = 0;
        clip.play().catch(() => {}); // Swallow NotAllowedError safely
    }

    // ── Fade helpers ──────────────────────────────────────────────────────────
    const FADE_IN_MS  = 600;  // ms to reach full volume
    const FADE_OUT_MS = 800;  // ms to reach silence
    const FADE_STEP   = 20;   // interval tick in ms

    function _clearFade(name) {
        if (fades[name] != null) {
            clearInterval(fades[name]);
            fades[name] = null;
        }
    }

    function _fadeTo(clip, name, toVol, durationMs, onDone) {
        _clearFade(name);
        const fromVol = clip.volume;
        const steps   = Math.max(1, Math.round(durationMs / FADE_STEP));
        const delta   = (toVol - fromVol) / steps;
        let   count   = 0;

        fades[name] = setInterval(() => {
            count++;
            clip.volume = Math.max(0, Math.min(1, fromVol + delta * count));
            if (count >= steps) {
                _clearFade(name);
                clip.volume = toVol;
                if (onDone) onDone();
            }
        }, FADE_STEP);
    }
    // ─────────────────────────────────────────────────────────────────────────

    function startLoop(name, volume = 1.0) {
        if (!ready) init();
        const file = FILES[name];
        if (!file) { console.warn("SFX: unknown loop sound:", name); return; }

        if (!loops[name]) {
            const audio = new Audio(BASE + file);
            audio.loop    = true;
            audio.preload = "auto";
            loops[name]   = audio;
        }

        baseVols[name] = volume;
        const clip  = loops[name];
        const mult  = (name === "bgm") ? bgmVol : sfxVol;
        const toVol = Math.max(0, Math.min(1, volume * mult));
        targets[name] = toVol;
        
        const fadeMs = (name === "bgm") ? 4000 : FADE_IN_MS;

        if (clip.paused || clip.ended) {
            // Start silent, then fade in
            clip.volume      = 0;
            clip.currentTime = 0;
            clip.play().catch(() => {});
            _fadeTo(clip, name, toVol, fadeMs, null);
        } else {
            // Already playing – just fade to the new target volume
            _fadeTo(clip, name, toVol, fadeMs, null);
        }
    }

    function stopLoop(name) {
        const clip = loops[name];
        if (!clip || clip.paused) return;
        
        const fadeMs = (name === "bgm") ? 4000 : FADE_OUT_MS;

        // Fade out, then pause
        _fadeTo(clip, name, 0, fadeMs, () => {
            clip.pause();
            clip.currentTime = 0;
        });
    }

    function warm(name) {
        if (!ready) init();
        const pool = pools[name];
        if (!pool) return;
        const clip = pool[0];
        clip.volume = 0.05;
        clip.currentTime = 0;
        const promise = clip.play();
        if (promise && promise.catch) {
            promise.then(() => {
                clip.pause();
                clip.currentTime = 0;
            }).catch(() => {
                clip.pause();
                clip.currentTime = 0;
            });
        }
    }

    function setSfxVolume(v) {
        sfxVol = Math.max(0, Math.min(1, v));
        // Update all playing SFX loops on the fly
        for (let key in loops) {
            if (key !== "bgm" && baseVols[key] != null && loops[key]) {
                const tv = Math.max(0, Math.min(1, baseVols[key] * sfxVol));
                targets[key] = tv;
                if (!loops[key].paused && !fades[key]) loops[key].volume = tv;
            }
        }
    }

    function setBgmVolume(v) {
        bgmVol = Math.max(0, Math.min(1, v));
        // Update playing BGM loop on the fly
        if (baseVols["bgm"] != null && loops["bgm"]) {
             const tv = Math.max(0, Math.min(1, baseVols["bgm"] * bgmVol));
             targets["bgm"] = tv;
             if (!loops["bgm"].paused && !fades["bgm"]) loops["bgm"].volume = tv;
        }
    }

    return { play, startLoop, stopLoop, init, warm, setSfxVolume, setBgmVolume };
})();
