// database.js

// NPC sell prices (coins per item)
const npcPrices = {
    "Brown Mushroom": 10,
    "Red Mushroom":   10,
    "Pumpkin":        10,
    "Wheat":           6,
    "Nether Wart":     4,
    "Cactus":          4,
    "Sugar Cane":      4,
    "Moonflower":      4,
    "Sunflower":       4,
    "Wild Rose":       4,
    "Carrot":          3,
    "Cocoa Beans":     3,
    "Potato":          3,
    "Melon Slice":     2
};

const CROP_BAZAAR_IDS = {
    "Wheat":          "WHEAT",
    "Carrot":         "CARROT_ITEM",
    "Potato":         "POTATO_ITEM",
    "Pumpkin":        "PUMPKIN",
    "Melon Slice":    "MELON",
    "Sugar Cane":     "SUGAR_CANE",
    "Nether Wart":    "NETHER_STALK",
    "Cactus":         "CACTUS",
    "Brown Mushroom": "BROWN_MUSHROOM",
    "Red Mushroom":   "RED_MUSHROOM",
    "Cocoa Beans":    "INK_SACK:3",
    "Wild Rose":      "WILD_ROSE",
    "Sunflower":      "DOUBLE_PLANT",
    "Moonflower":     "MOONFLOWER"
};

const RARITY_COLORS = {
    "COMMON":    "#cccccc",
    "UNCOMMON":  "#4ade80",
    "RARE":      "#60a5fa",
    "EPIC":      "#c084fc",
    "LEGENDARY": "#ffd700"
};

const mutationDatabase = {
    // ── COMMON ──────────────────────────────────────────────
    "Ashwreath":         { drops: { "Nether Wart": 360 },                                                                                                                                                    image: "images/Ashwreath.webp",          rarity: "COMMON",    stages: 1,  requiresWater: false },
    "Choconut":          { drops: { "Cocoa Beans": 200 },                                                                                                                                                    image: "images/Choconut.webp",           rarity: "COMMON",    stages: 1,  requiresWater: false },
    "Dustgrain":         { drops: { "Wheat": 100 },                                                                                                                                                          image: "images/Dustgrain.webp",          rarity: "COMMON",    stages: 1,  requiresWater: false },
    "Gloomgourd":        { drops: { "Pumpkin": 30, "Melon Slice": 140 },                                                                                                                                     image: "images/Gloomgourd.webp",         rarity: "COMMON",    stages: 1,  requiresWater: false },
    "Lonelily":          { drops: { "Potato": 600, "Carrot": 700, "Pumpkin": 340 },                                                                                                                          image: "images/Lonelily.webp",           rarity: "COMMON",    stages: 1,  requiresWater: false },
    "Scourroot":         { drops: { "Potato": 105, "Carrot": 122 },                                                                                                                                          image: "images/Scourroot.webp",          rarity: "COMMON",    stages: 1,  requiresWater: false },
    "Shadevine":         { drops: { "Cactus": 68, "Sugar Cane": 90 },                                                                                                                                        image: "images/Shadevine.webp",          rarity: "COMMON",    stages: 1,  requiresWater: false },
    "Veilshroom":        { drops: { "Brown Mushroom": 33, "Red Mushroom": 33 },                                                                                                                              image: "images/Veilshroom.webp",         rarity: "COMMON",    stages: 1,  requiresWater: false },
    "Witherbloom":       { drops: { "Wild Rose": 300 },                                                                                                                                                      image: "images/Witherbloom.webp",        rarity: "COMMON",    stages: 1,  requiresWater: false },
    // ── UNCOMMON ────────────────────────────────────────────
    "Chocoberry":        { drops: { "Cocoa Beans": 400, "Pumpkin": 170, "Melon Slice": 1600 },                                                                                                               image: "images/Chocoberry.webp",         rarity: "UNCOMMON",  stages: 6,  requiresWater: true  },
    "Cindershade":       { drops: { "Nether Wart": 1200, "Wild Rose": 800 },                                                                                                                                 image: "images/Cindershade.webp",        rarity: "UNCOMMON",  stages: 8,  requiresWater: true  },
    "Coalroot":          { drops: { "Potato": 600, "Carrot": 1400, "Nether Wart": 600 },                                                                                                                     image: "images/Coalroot.webp",           rarity: "UNCOMMON",  stages: 8,  requiresWater: true  },
    "Creambloom":        { drops: { "Cocoa Beans": 1600 },                                                                                                                                                   image: "images/Creambloom.webp",         rarity: "UNCOMMON",  stages: 6,  requiresWater: true  },
    "Duskbloom":         { drops: { "Moonflower": 533, "Sunflower": 533, "Wheat": 267 },                                                                                                                     image: "images/Duskbloom.webp",          rarity: "UNCOMMON",  stages: 8,  requiresWater: true  },
    "Thornshade":        { drops: { "Brown Mushroom": 190, "Red Mushroom": 190, "Wild Rose": 800 },                                                                                                          image: "images/Thornshade.webp",         rarity: "UNCOMMON",  stages: 8,  requiresWater: true  },
    // ── RARE ────────────────────────────────────────────────
    "Blastberry":        { drops: { "Cocoa Beans": 1200, "Nether Wart": 1800 },                                                                                                                              image: "images/Blastberry.webp",         rarity: "RARE",      stages: 8,  requiresWater: true  },
    "Cheesebite":        { drops: { "Brown Mushroom": 190, "Cactus": 600, "Sugar Cane": 800, "Red Mushroom": 190 },                                                                                          image: "images/Cheesebite.webp",         rarity: "RARE",      stages: 8,  requiresWater: true  },
    "Chloronite":        { drops: { "Brown Mushroom": 95, "Potato": 600, "Carrot": 700, "Red Mushroom": 95, "Wild Rose": 400 },                                                                              image: "images/Chloronite.webp",         rarity: "RARE",      stages: 8,  requiresWater: true  },
    "Do-not-eat-shroom": { drops: { "Brown Mushroom": 380, "Potato": 1200, "Carrot": 1400, "Red Mushroom": 380 },                                                                                            image: "images/Do-not-eat-shroom.webp",  rarity: "RARE",      stages: 8,  requiresWater: true  },
    "Fleshtrap":         { drops: { "Potato": 1200, "Carrot": 1400, "Pumpkin": 680 },                                                                                                                        image: "images/Fleshtrap.webp",          rarity: "RARE",      stages: 8,  requiresWater: true  },
    "Magic Jellybean":   { drops: { "Moonflower": 600, "Sunflower": 600, "Sugar Cane": 1200 },                                                                                                               image: "images/Magic Jellybean.webp",    rarity: "RARE",      stages: 12, requiresWater: true  },
    "Noctilume":         { drops: { "Cactus": 1200, "Wild Rose": 1600 },                                                                                                                                     image: "images/Noctilume.webp",          rarity: "RARE",      stages: 8,  requiresWater: true  },
    "Snoozling":         { drops: { "Moonflower": 800, "Sunflower": 800, "Cactus": 600, "Sugar Cane": 800 },                                                                                                 image: "images/Snoozling.webp",          rarity: "RARE",      stages: 8,  requiresWater: true  },
    "Soggybud":          { drops: { "Melon Slice": 3200 },                                                                                                                                                   image: "images/Soggybud.webp",           rarity: "RARE",      stages: 8,  requiresWater: true  },
    // ── EPIC ────────────────────────────────────────────────
    "Chorus Fruit":      { drops: { "Potato": 1500, "Carrot": 1700, "Sugar Cane": 2000 },                                                                                                                    image: "images/Chorus Fruit.webp",       rarity: "EPIC",      stages: 12, requiresWater: true  },
    "PlantBoy Advance":  { drops: { "Moonflower": 1200, "Sunflower": 1200, "Wheat": 122 },                                                                                                                   image: "images/Plantboy Advance.webp",   rarity: "EPIC",      stages: 12, requiresWater: true  },
    "Puffercloud":       { drops: { "Brown Mushroom": 665, "Moonflower": 1400, "Sunflower": 1400, "Red Mushroom": 665 },                                                                                     image: "images/Puffercloud.webp",        rarity: "EPIC",      stages: 14, requiresWater: true  },
    "Shellfruit":        { drops: { "Cocoa Beans": 400, "Melon Slice": 800 },                                                                                                                                image: "images/Shellfruit.webp",         rarity: "EPIC",      stages: 1,  requiresWater: false },
    "Startlevine":       { drops: { "Cactus": 1500, "Sugar Cane": 2000 },                                                                                                                                    image: "images/Startlevine.webp",        rarity: "EPIC",      stages: 12, requiresWater: true  },
    "Stoplight Petal":   { drops: { "Cactus": 2400, "Wild Rose": 3200 },                                                                                                                                     image: "images/Stoplight Petal.webp",    rarity: "EPIC",      stages: 12, requiresWater: true  },
    "Thunderling":       { drops: { "Cactus": 900, "Melon Slice": 2400, "Wild Rose": 2400 },                                                                                                                 image: "images/Thunderling.webp",        rarity: "EPIC",      stages: 16, requiresWater: true  },
    "Turtlellini":       { drops: {},                                                                                                                                                                         image: "images/Turtlellini.webp",        rarity: "EPIC",      stages: 1,  requiresWater: false },
    "Zombud":            { drops: { "Pumpkin": 1190, "Wild Rose": 2800 },                                                                                                                                     image: "images/Zombud.webp",             rarity: "EPIC",      stages: 16, requiresWater: true  },
    // ── LEGENDARY ───────────────────────────────────────────
    "All-in Aloe":       { drops: { "Moonflower": 100, "Sunflower": 100, "Wheat": 100 },                                                                                                                     image: "images/All-in Aloe.webp",        rarity: "LEGENDARY", stages: 16, requiresWater: true  },
    "Devourer":          { drops: { "Pumpkin": 1700, "Brown Mushroom": 950, "Red Mushroom": 950 },                                                                                                           image: "images/Devourer.webp",           rarity: "LEGENDARY", stages: 16, requiresWater: true  },
    "Glasscorn":         { drops: { "Cactus": 2400, "Potato": 4800 },                                                                                                                                        image: "images/Glasscorn.webp",          rarity: "LEGENDARY", stages: 16, requiresWater: true  },
    "Godseed":           { drops: { "Cactus": 369, "Carrot": 862, "Melon Slice": 985, "Cocoa Beans": 492, "Moonflower": 492, "Sunflower": 492, "Sugar Cane": 492, "Wild Rose": 492, "Nether Wart": 738, "Potato": 738, "Pumpkin": 209, "Brown Mushroom": 117, "Red Mushroom": 117, "Wheat": 246 }, image: "images/Godseed.webp", rarity: "LEGENDARY", stages: 40, requiresWater: true  },
    "Jerryflower":       { drops: {},                                                                                                                                                                         image: "images/Jerryflower.webp",        rarity: "LEGENDARY", stages: 16, requiresWater: true  },
    "Phantomleaf":       { drops: { "Potato": 4800, "Carrot": 5600 },                                                                                                                                        image: "images/Phantomleaf.webp",        rarity: "LEGENDARY", stages: 15, requiresWater: true  },
    "Timestalk":         { drops: { "Cactus": 3000, "Sugar Cane": 4000 },                                                                                                                                    image: "images/Timestalk.webp",          rarity: "LEGENDARY", stages: 14, requiresWater: true  }
};
