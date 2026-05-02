import type { ScenePlan } from "./sceneSchema";

export const demoMuralUrl = "/demo/pageworld-demo-panorama.png";

export const demoSplatPreviewImages: Record<string, string> = {
  "diagon-alley-arrival": "/demo/splat-previews/diagon-alley-arrival.webp",
  "hogwarts-express-platform": "/demo/splat-previews/hogwarts-express-platform.webp",
  "great-hall-sorting": "/demo/splat-previews/great-hall-sorting.webp",
  "forbidden-forest": "/demo/splat-previews/forbidden-forest.webp"
};

export const demoScenes: ScenePlan[] = [
  {
    id: "diagon-alley-arrival",
    title: "Diagon Alley",
    summary: "Harry steps from an ordinary brick wall into a crowded wizarding street full of shops, signs, and impossible objects.",
    layoutType: "corridor_path",
    dressing:
      "a narrow cobblestone shopping street with crooked storefronts, stacked chimneys, glowing windows, owl cages, barrels, and wand-shop displays",
    mood: "wonder",
    stylePrompt:
      "walkable magical shopping alley, cobblestone street, crooked shopfronts, warm window light, owl cages, wand boxes, whimsical but grounded cinematic fantasy environment",
    narration:
      "The hidden street opens like a secret the city had been keeping. Every window promises a different kind of magic, and every step pulls Harry farther from the ordinary world.",
    sourceAnchors: [
      {
        quote: "Demo beat: Harry discovers the hidden magical marketplace for the first time.",
        meaning: "The first scene establishes discovery, scale, and the threshold between ordinary and magical life."
      }
    ],
    objects: [
      {
        id: "wand-shop-window",
        label: "Wand Shop Window",
        visualType: "sign",
        description: "A narrow storefront window filled with stacked wand boxes and a single box glowing brighter than the rest.",
        quote: "Demo beat: a wand chooses its wizard.",
        explanation: "The wand window turns the larger marketplace into a personal call to adventure.",
        slot: "right"
      },
      {
        id: "owl-cage",
        label: "Owl Cage",
        visualType: "artifact",
        description: "A brass cage with white feathers caught in the latch, placed beside a cluttered shop step.",
        quote: "Demo beat: magical tools and companions are suddenly real.",
        explanation: "The owl cage makes the new world feel lived in rather than purely symbolic.",
        slot: "left"
      },
      {
        id: "brick-threshold",
        label: "Brick Threshold",
        visualType: "door",
        description: "A brick archway remains open behind the player, revealing the passage from the nonmagical street.",
        quote: "Demo beat: the wall opens and the hidden world appears.",
        explanation: "This threshold gives the scene a clear origin point and transition into the story.",
        slot: "back"
      }
    ],
    transitionToNext: {
      label: "To King's Cross",
      description: "A floating ticket points toward the train platform and the start of the school journey."
    },
    integrations: {
      narration: {
        provider: "elevenlabs",
        script:
          "The brick wall behind Harry has not simply opened; it has folded one life into another. A narrow cobblestone street stretches ahead, crowded with crooked shopfronts, stacked chimneys, hanging lanterns, and windows warm enough to make the whole alley feel awake. On the right, a wand shop window is packed with long boxes, but one box seems to catch the light as if it has been waiting for a particular hand. On the left, an owl cage sits beside a cluttered step, with pale feathers caught in the brass latch, making the impossible feel practical, ordinary, and close enough to touch. Behind you, the brick threshold is still visible, a reminder that the nonmagical city is only a few steps away, but already feels very far behind. This is the first real proof that magic is not a rumor or a trick. It has streets, tools, companions, shop windows, errands, and rules. Harry is not just looking at a hidden marketplace. He is standing at the entrance to a world that expects him to keep walking.",
        audioUrl: null
      },
      walkableWorld: {
        provider: "world-labs",
        prompt:
          "Create a richly detailed walkable first-person 3D world for a magical British wizarding marketplace. The player should stand on a narrow cobblestone street with a clear navigable path running forward through the scene, tall crooked shopfronts leaning inward on both sides, stacked chimneys, warm golden window light, hanging lanterns, barrels, crates, owl cages, wand boxes in display windows, broom handles, potion bottles, cloth awnings, uneven brick walls, and a visible brick archway behind the player as the entry threshold. Use strong foreground, midground, and background depth so the scene works as a Gaussian splat walkthrough. Make the environment whimsical but physically grounded, with realistic stone, wood, brass, glass, paper, and feather materials. No readable text, no logos, no characters, no modern objects, no flat backdrop, no fisheye distortion.",
        splatUrl: null,
        status: "planned"
      }
    }
  },
  {
    id: "hogwarts-express-platform",
    title: "Platform Nine and Three-Quarters",
    summary: "Harry finds the hidden platform, boards the scarlet train, and begins the journey toward Hogwarts.",
    layoutType: "corridor_path",
    dressing:
      "a steam-filled train platform with brick pillars, luggage carts, hanging lamps, a scarlet steam engine, school trunks, and families fading into fog",
    mood: "warm",
    stylePrompt:
      "hidden steam train platform, scarlet locomotive, brick pillars, luggage carts, warm lamps, drifting steam, first-person walkable cinematic fantasy station",
    narration:
      "Steam curls around the platform, softening the edge between fear and excitement. The train waits like a promise, and the school year is already pulling away from the station.",
    sourceAnchors: [
      {
        quote: "Demo beat: Harry crosses onto the hidden platform and leaves for school.",
        meaning: "The second scene turns discovery into forward motion."
      }
    ],
    objects: [
      {
        id: "school-trunk",
        label: "School Trunk",
        visualType: "artifact",
        description: "A worn trunk sits beside the train, strapped shut and ready for a first year at Hogwarts.",
        quote: "Demo beat: the journey to school begins with a packed trunk.",
        explanation: "The trunk makes the transition feel practical and personal.",
        slot: "center"
      },
      {
        id: "platform-clock",
        label: "Platform Clock",
        visualType: "clock",
        description: "A brass clock hangs above the platform, nearly lost in the steam.",
        quote: "Demo beat: there is a precise train to catch.",
        explanation: "The clock adds urgency and anchors the scene in a departure moment.",
        slot: "wall"
      },
      {
        id: "train-door",
        label: "Train Door",
        visualType: "door",
        description: "The carriage door stands open, warm light spilling from inside the train.",
        quote: "Demo beat: stepping onto the train means choosing the wizarding world.",
        explanation: "The open door is the next playable threshold.",
        slot: "right"
      }
    ],
    transitionToNext: {
      label: "Enter the Great Hall",
      description: "The train whistle becomes the hush of the school hall before the Sorting."
    },
    integrations: {
      narration: {
        provider: "elevenlabs",
        script:
          "The platform is hidden in plain sight, but the train is unmistakable. Trunks scrape against stone, steam blurs the lamps, and Harry steps toward Hogwarts.",
        audioUrl: null
      },
      walkableWorld: {
        provider: "world-labs",
        prompt:
          "Create a detailed walkable first-person hidden railway platform for a magical school departure. The player should stand on a long stone platform with brick pillars forming a corridor, a scarlet steam locomotive along one side, open carriage doors, brass handles, luggage carts, stacked school trunks, bird cages, warm hanging lamps, benches, iron railings, polished train wheels, drifting steam layers, and a vanishing point down the platform. Design it for spatial exploration with enough ground clearance to walk, clear left/right landmarks, and dense but readable props. Lighting should be warm amber lamps cutting through cool white steam. No readable platform signs, no logos, no real-world brand marks, no crowds or characters, no flat wall backdrop.",
        splatUrl: null,
        status: "planned"
      }
    }
  },
  {
    id: "great-hall-sorting",
    title: "The Great Hall",
    summary: "The first years enter the candlelit hall, face the Sorting, and see Hogwarts as a living castle for the first time.",
    layoutType: "interior_room",
    dressing:
      "a vast stone dining hall with long wooden tables, floating candles, tall windows, banners, a stool at the front, and a starry enchanted ceiling",
    mood: "mysterious",
    stylePrompt:
      "grand magical castle dining hall, floating candles, long tables, stone arches, starry ceiling, school banners, warm gold light, walkable first-person interior",
    narration:
      "The hall is larger than a room and stranger than a dream. Candles hover overhead, the ceiling holds the night sky, and every first year waits to be named.",
    sourceAnchors: [
      {
        quote: "Demo beat: Harry enters the Great Hall and is sorted into a house.",
        meaning: "The third scene makes Hogwarts feel ceremonial, social, and alive."
      }
    ],
    objects: [
      {
        id: "sorting-stool",
        label: "Sorting Stool",
        visualType: "artifact",
        description: "A small wooden stool sits at the front of the hall beneath a cone of candlelight.",
        quote: "Demo beat: each student is called forward to be sorted.",
        explanation: "The stool centers the scene on identity and belonging.",
        slot: "center"
      },
      {
        id: "floating-candle",
        label: "Floating Candle",
        visualType: "lamp",
        description: "A candle drifts just above reach, its flame steady in the enchanted air.",
        quote: "Demo beat: the hall's magic is visible before anyone explains it.",
        explanation: "The candle makes the room's impossible atmosphere immediately readable.",
        slot: "left"
      },
      {
        id: "house-banner",
        label: "House Banner",
        visualType: "portrait",
        description: "A tall banner hangs from the stone wall, catching gold light from the tables.",
        quote: "Demo beat: Hogwarts is divided into houses with strong identities.",
        explanation: "The banner hints at the school structure that will shape the story.",
        slot: "wall"
      }
    ],
    transitionToNext: {
      label: "Into the Forbidden Forest",
      description: "The candlelight thins into moonlight between dark trees."
    },
    integrations: {
      narration: {
        provider: "elevenlabs",
        script:
          "The Great Hall glows with floating candles and nervous silence. This is not just a school dinner; it is the moment Hogwarts decides where Harry belongs.",
        audioUrl: null
      },
      walkableWorld: {
        provider: "world-labs",
        prompt:
          "Create a grand walkable first-person magical castle dining hall for a ceremonial school sorting scene. The space should be a large stone interior with a clear central aisle, long wooden banquet tables on both sides, benches, brass plates, goblets, candles, towering stone arches, tall leaded windows, hanging fabric banners with no readable symbols, a small wooden stool and pedestal at the far end, and an enchanted ceiling that feels like a starry night sky. Floating candles should create warm golden pools of light with soft shadows on the stone floor. Use strong architectural depth, visible walls, ceiling, floor, and a clear navigable route from entrance to front. No readable text, no logos, no characters, no modern objects, no abstract title-card composition.",
        splatUrl: null,
        status: "planned"
      }
    }
  },
  {
    id: "forbidden-forest",
    title: "The Forbidden Forest",
    summary: "The path leaves the safety of the castle and enters a moonlit forest where danger, courage, and old magic gather.",
    layoutType: "open_clearing",
    dressing:
      "a dark forest clearing with twisted roots, silver moonlight, low fog, distant castle lights, broken branches, and a narrow path through black trees",
    mood: "tense",
    stylePrompt:
      "moonlit forbidden forest clearing, twisted roots, fog, silver light, distant castle silhouettes, magical danger, walkable cinematic fantasy woodland",
    narration:
      "Past the castle grounds, the trees close in. The forest is quiet in the wrong way, as if every branch is listening before deciding what to reveal.",
    sourceAnchors: [
      {
        quote: "Demo beat: the Forbidden Forest tests courage outside the safety of Hogwarts.",
        meaning: "The final scene gives the demo a tense outdoor endpoint and a strong contrast with the school interiors."
      }
    ],
    objects: [
      {
        id: "moonlit-root",
        label: "Moonlit Root",
        visualType: "tree",
        description: "A twisted root crosses the path, lit by a thin stripe of silver moonlight.",
        quote: "Demo beat: the forest path is dangerous and uncertain.",
        explanation: "The root turns the environment into an obstacle the player can read spatially.",
        slot: "floor"
      },
      {
        id: "silver-memory",
        label: "Silver Memory",
        visualType: "memory_orb",
        description: "A pale orb hovers above the clearing, bright enough to push back the fog.",
        quote: "Demo beat: protective magic appears as light against the dark.",
        explanation: "The orb previews later protective magic without needing a literal character model.",
        slot: "center"
      },
      {
        id: "forest-lantern",
        label: "Forest Lantern",
        visualType: "lamp",
        description: "A half-buried lantern glows beside the trail, marking the way back toward the castle.",
        quote: "Demo beat: the way home remains visible but fragile.",
        explanation: "The lantern gives the final scene a safe return point.",
        slot: "right"
      }
    ],
    transitionToNext: {
      label: "Return to the Castle",
      description: "A cold path through the trees opens back toward Hogwarts."
    },
    integrations: {
      narration: {
        provider: "elevenlabs",
        script:
          "The forest is where the bright rules of school stop working. Moonlight catches the roots, fog hides the path, and courage becomes the only clear direction.",
        audioUrl: null
      },
      walkableWorld: {
        provider: "world-labs",
        prompt:
          "Create a tense walkable first-person moonlit magical forest clearing outside a distant castle. The player should stand on a narrow dirt path that opens into a small clearing with navigable ground, twisted tree trunks, exposed roots crossing the path, mossy stones, broken branches, low blue-gray fog, silver moonlight shafts, wet leaves, a half-buried lantern near the trail, and a faint castle glow visible far behind the trees. Build strong foreground roots, midground clearing details, and background tree silhouettes for deep spatial parallax in a Gaussian splat. The mood should be dangerous but beautiful, with cool moonlight and small warm lantern contrast. No characters, no creatures, no readable text, no logos, no flat painted backdrop, no fisheye distortion.",
        splatUrl: null,
        status: "planned"
      }
    }
  }
];
