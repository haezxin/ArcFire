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
        this.parachuteY = 0; // For parachuting state
        this.selectedAmmoSlot = 0; // Current ammo selection
        this.stuckTurns = 0; // Turns remaining for Oil/Stuck effect

        // Ammo inventory per slot:
        // [Standard, Cluster, Oil, Napalm]
        // Standard is infinite; others are limited.
        this.ammoCounts = [Infinity, 3, 4, 4];
    }

    get y() {
        if (this.state === "parachuting") {
            return this.parachuteY;
        }
        return getTerrainY(this.x);
    }

    muzzlePoint() {
        const angle = getTerrainAngle(this.x);
        const turretOffY = -37;
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
