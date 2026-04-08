const SOURCES = {
    parachute: "globalAssets/parachute.png",
    tankBlueParachute: "globalAssets/tankBlueParachute.png",
    tankRedParachute: "globalAssets/tankRedParachute.png",
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

    // ── War 1 assets (Ruins)
    bg_war1_bright: "War1/Bright/War.png",
    bg_war1_pale: "War1/Pale/War.png",
    sky_war1_bright: "War1/Bright/sky.png",
    sky_war1_pale: "War1/Pale/sky.png",
    sun_war1_bright: "War1/Bright/sun.png",
    sun_war1_pale: "War1/Pale/sun.png",
    dec_war1_fence_bright: "War1/Bright/fence.png",
    dec_war1_fence_pale: "War1/Pale/fence.png",
    dec_war1_ruins_bright: "War1/Bright/ruins.png",
    dec_war1_ruins_pale: "War1/Pale/ruins.png",
    dec_war1_h1_bright: "War1/Bright/houses1.png",
    dec_war1_h1_pale: "War1/Pale/houses1.png",
    dec_war1_h2_bright: "War1/Bright/houses2.png",
    dec_war1_h2_pale: "War1/Pale/houses2.png",
    dec_war1_h3_bright: "War1/Bright/house3.png",
    dec_war1_h3_pale: "War1/Pale/house3.png",
    plat_war1_bright: "War1/Bright/road.png",
    plat_war1_pale: "War1/Pale/road.png",
    crater1_war1_bright: "War1/Bright/crater1.png",
    crater2_war1_bright: "War1/Bright/crater2.png",
    crater3_war1_bright: "War1/Bright/crater3.png",
    crater1_war1_pale: "War1/Pale/crater1.png",
    crater2_war1_pale: "War1/Pale/crater2.png",
    crater3_war1_pale: "War1/Pale/crater3.png",

    // ── War 2 assets (Desert)
    bg_war2_bright: "War2/Bright/War2.png",
    bg_war2_pale: "War2/Pale/War2.png",
    sky_war2_bright: "War2/Bright/sky.png",
    sky_war2_pale: "War2/Pale/sky.png",
    dec_war2_wall_bright: "War2/Bright/wall.png",
    dec_war2_wall_pale: "War2/Pale/wall.png",
    dec_war2_h1_bright: "War2/Bright/houses1.png",
    dec_war2_h1_pale: "War2/Pale/houses1.png",
    dec_war2_h2_bright: "War2/Bright/houses2.png",
    dec_war2_h2_pale: "War2/Pale/houses2.png",
    dec_war2_h3_bright: "War2/Bright/houses3.png",
    dec_war2_h3_pale: "War2/Pale/houses3.png",
    dec_war2_h4_bright: "War2/Bright/houses4.png",
    dec_war2_h4_pale: "War2/Pale/houses4.png",
    dec_war2_crack1_bright: "War2/Bright/cracks1.png",
    dec_war2_crack1_pale: "War2/Pale/cracks1.png",
    dec_war2_crack2_bright: "War2/Bright/cracks2.png",
    dec_war2_crack2_pale: "War2/Pale/cracks2.png",
    plat_war2_bright: "War2/Bright/road.png",
    plat_war2_pale: "War2/Pale/road.png",
    crater1_war2_bright: "War1/Bright/crater1.png",
    crater2_war2_bright: "War1/Bright/crater2.png",
    crater3_war2_bright: "War1/Bright/crater3.png",
    crater1_war2_pale: "War1/Pale/crater1.png",
    crater2_war2_pale: "War1/Pale/crater2.png",
    crater3_war2_pale: "War1/Pale/crater3.png",

    // ── War 3 assets (Urban Green)
    bg_war3_bright: "War3/Bright/War3.png",
    bg_war3_pale: "War3/Pale/War3.png",
    sky_war3_bright: "War3/Bright/sky.png",
    sky_war3_pale: "War3/Pale/sky.png",
    dec_war3_fence_bright: "War3/Bright/fence.png",
    dec_war3_fence_pale: "War3/Pale/fence.png",
    dec_war3_trees_bright: "War3/Bright/trees.png",
    dec_war3_trees_pale: "War3/Pale/trees.png",
    dec_war3_h2_bright: "War3/Bright/houses2.png",
    dec_war3_h2_pale: "War3/Pale/houses2.png",
    dec_war3_b1_bright: "War3/Bright/bricks1.png",
    dec_war3_b1_pale: "War3/Pale/bricks1.png",
    dec_war3_b2_bright: "War3/Bright/bricks2.png",
    dec_war3_b2_pale: "War3/Pale/bricks2.png",
    plat_war3_bright: "War3/Bright/road.png",
    plat_war3_pale: "War3/Pale/road.png",
    crater1_war3_bright: "War1/Bright/crater1.png",
    crater2_war3_bright: "War1/Bright/crater2.png",
    crater3_war3_bright: "War1/Bright/crater3.png",
    crater1_war3_pale: "War1/Pale/crater1.png",
    crater2_war3_pale: "War1/Pale/crater2.png",
    crater3_war3_pale: "War1/Pale/crater3.png",

    // ── War 4 assets (Night City)
    bg_war4_bright: "War4/Bright/War4.png",
    bg_war4_pale: "War4/Pale/War4.png",
    sky_war4_bright: "War4/Bright/sky.png",
    sky_war4_pale: "War4/Pale/sky.png",
    dec_war4_moon_bright: "War4/Bright/moon.png",
    dec_war4_moon_pale: "War4/Pale/moon.png",
    dec_war4_wall_bright: "War4/Bright/wall.png",
    dec_war4_wall_pale: "War4/Pale/wall.png",
    dec_war4_h1_bright: "War4/Bright/houses1.png",
    dec_war4_h1_pale: "War4/Pale/houses1.png",
    dec_war4_h2_bright: "War4/Bright/houses2.png",
    dec_war4_h2_pale: "War4/Pale/houses2.png",
    dec_war4_wheels1_bright: "War4/Bright/wheels.png",
    dec_war4_wheels1_pale: "War4/Pale/wheels.png",
    dec_war4_wheels2_bright: "War4/Bright/wheels2.png",
    dec_war4_wheels2_pale: "War4/Pale/wheels2.png",
    dec_war4_wheels3_bright: "War4/Bright/wheels3.png",
    dec_war4_wheels3_pale: "War4/Pale/wheels3.png",
    plat_war4_bright: "War4/Bright/road.png",
    plat_war4_pale: "War4/Pale/road.png",
    crater1_war4_bright: "War1/Bright/crater1.png",
    crater2_war4_bright: "War1/Bright/crater2.png",
    crater3_war4_bright: "War1/Bright/crater3.png",
    crater1_war4_pale: "War1/Pale/crater1.png",
    crater2_war4_pale: "War1/Pale/crater2.png",
    crater3_war4_pale: "War1/Pale/crater3.png",

    // ── Powerups & misc
    size_power_up: "powerups/targetSize.png",
    missile1: "powerups/missile1.png",
    missile2: "powerups/missile2.png",
    title_page: "globalAssets/titlePage.jpg",
    ammo_standard: "globalAssets/Standard.png",
    ammo_cluster: "globalAssets/Cluster.png",
    ammo_oil: "globalAssets/Oil.png",
    ammo_napalm: "globalAssets/Napalm.png",

    // ── Customizable Tank Parts (PNG/Default size)
    // BODIES
    body_green_1: "PNG/Default size/tanks_tankGreen_body1.png",
    body_green_2: "PNG/Default size/tanks_tankGreen_body2.png",
    body_green_3: "PNG/Default size/tanks_tankGreen_body3.png",
    body_green_4: "PNG/Default size/tanks_tankGreen_body4.png",
    body_green_5: "PNG/Default size/tanks_tankGreen_body5.png",

    body_red_1: "PNG/Default size/tanks_tankDesert_body1.png",
    body_red_2: "PNG/Default size/tanks_tankDesert_body2.png",
    body_red_3: "PNG/Default size/tanks_tankDesert_body3.png",
    body_red_4: "PNG/Default size/tanks_tankDesert_body4.png",
    body_red_5: "PNG/Default size/tanks_tankDesert_body5.png",

    body_grey_1: "PNG/Default size/tanks_tankGrey_body1.png",
    body_grey_2: "PNG/Default size/tanks_tankGrey_body2.png",
    body_grey_3: "PNG/Default size/tanks_tankGrey_body3.png",
    body_grey_4: "PNG/Default size/tanks_tankGrey_body4.png",
    body_grey_5: "PNG/Default size/tanks_tankGrey_body5.png",

    body_navy_1: "PNG/Default size/tanks_tankNavy_body1.png",
    body_navy_2: "PNG/Default size/tanks_tankNavy_body2.png",
    body_navy_3: "PNG/Default size/tanks_tankNavy_body3.png",
    body_navy_4: "PNG/Default size/tanks_tankNavy_body4.png",
    body_navy_5: "PNG/Default size/tanks_tankNavy_body5.png",
    
    // TURRETS
    turret_1: "PNG/Default size/tanks_turret1.png",
    turret_2: "PNG/Default size/tanks_turret2.png",
    turret_3: "PNG/Default size/tanks_turret3.png",
    turret_4: "PNG/Default size/tanks_turret4.png",

    // TRACKS
    tracks_1: "PNG/Default size/tanks_tankTracks1.png",
    tracks_2: "PNG/Default size/tanks_tankTracks2.png",
    tracks_3: "PNG/Default size/tanks_tankTracks3.png",
    tracks_4: "PNG/Default size/tanks_tankTracks4.png",
    tracks_5: "PNG/Default size/tanks_tankTracks5.png",
    tracks_6: "PNG/Default size/tanks_tankTracks6.png",
    tracks_7: "PNG/Default size/tanks_tankTracks7.png",

    // ── Full Pre-assembled Tanks
    tank_desert_1: "PNG/Default size/tanks_tankDesert1.png",
    tank_desert_2: "PNG/Default size/tanks_tankDesert2.png",
    tank_desert_3: "PNG/Default size/tanks_tankDesert3.png",
    tank_desert_4: "PNG/Default size/tanks_tankDesert4.png",
    tank_desert_5: "PNG/Default size/tanks_tankDesert5.png",

    tank_green_1: "PNG/Default size/tanks_tankGreen1.png",
    tank_green_2: "PNG/Default size/tanks_tankGreen2.png",
    tank_green_3: "PNG/Default size/tanks_tankGreen3.png",
    tank_green_4: "PNG/Default size/tanks_tankGreen4.png",
    tank_green_5: "PNG/Default size/tanks_tankGreen5.png",

    tank_grey_1: "PNG/Default size/tanks_tankGrey1.png",
    tank_grey_2: "PNG/Default size/tanks_tankGrey2.png",
    tank_grey_3: "PNG/Default size/tanks_tankGrey3.png",
    tank_grey_4: "PNG/Default size/tanks_tankGrey4.png",
    tank_grey_5: "PNG/Default size/tanks_tankGrey5.png",

    tank_navy_1: "PNG/Default size/tanks_tankNavy1.png",
    tank_navy_2: "PNG/Default size/tanks_tankNavy2.png",
    tank_navy_3: "PNG/Default size/tanks_tankNavy3.png",
    tank_navy_4: "PNG/Default size/tanks_tankNavy4.png",
    tank_navy_5: "PNG/Default size/tanks_tankNavy5.png",

    // ── Explosion frames
    explosion_1: "PNG/Default size/tank_explosion1.png",
    explosion_2: "PNG/Default size/tank_explosion2.png",
    explosion_3: "PNG/Default size/tank_explosion3.png",
    explosion_4: "PNG/Default size/tank_explosion4.png",
    explosion_5: "PNG/Default size/tank_explosion5.png",
    explosion_6: "PNG/Default size/tank_explosion6.png",
    explosion_7: "PNG/Default size/tank_explosion7.png",
    explosion_8: "PNG/Default size/tank_explosion8.png",
    explosion_9: "PNG/Default size/tank_explosion9.png",
    explosion_10: "PNG/Default size/tank_explosion10.png",
    explosion_11: "PNG/Default size/tank_explosion11.png",
    explosion_12: "PNG/Default size/tank_explosion12.png",
};

function preloadImages(sources, callback) {
    let loaded = 0;
    let total = Object.keys(sources).length;
    if (total === 0 && callback) {
        callback();
        return;
    }
    for (let key in sources) {
        let img = new Image();
        img.onload = () => {
            loaded++;
            if (loaded === total && callback) callback();
        };
        img.onerror = () => {
            console.error("Missing asset: " + sources[key]);
            loaded++;
            if (loaded === total && callback) callback();
        };
        img.src = sources[key];
        IMAGES[key] = img;
    }
}

function getCroppedImage(imgKey) {
    let img = IMAGES[imgKey];
    if (!img || !img.complete || img.naturalWidth === 0) return img;
    let cacheKey = imgKey + "_cropped";
    if (IMAGES[cacheKey]) return IMAGES[cacheKey];

    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h).data;

    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (data[(y * w + x) * 4 + 3] > 10) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (minX > maxX || minY > maxY) return img; // Failsafe
    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    if (cropW > w * 0.9 && cropH > h * 0.9) return img; // Unnecessary

    const cropped = document.createElement("canvas");
    cropped.width = cropW;
    cropped.height = cropH;
    cropped.getContext("2d").drawImage(img, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

    // Store in cache for blazing fast instant retrievals next round!
    IMAGES[cacheKey] = cropped;
    return cropped;
}
