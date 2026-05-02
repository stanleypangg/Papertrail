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
          "Create a richly detailed walkable first-person 3D world for Diagon Alley, the hidden British wizarding marketplace Harry first discovers behind the Leaky Cauldron. The player should stand just beyond the brick-wall entrance on a narrow cobblestone street with a clear navigable path forward. Include tall crooked shopfronts leaning inward on both sides, stacked chimneys, warm golden window light, hanging lanterns, barrels, crates, owl cages, wand boxes in a narrow wand-shop display, cauldrons, apothecary bottles, broom handles, parchment bundles, cloth awnings, uneven brick walls, and a white marble wizarding bank facade visible far down the street as a distant landmark. Use strong foreground, midground, and background depth so the scene works as a Gaussian splat walkthrough, with realistic stone, wood, brass, glass, paper, feathers, wet cobblestones, and warm window reflections. Whimsical but physically grounded, crowded with magical objects but with enough open floor to walk. No readable text, no logos, no characters, no modern objects, no flat backdrop, no fisheye distortion.",
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
      label: "Cross the Black Lake",
      description: "The train steam fades into cold lake mist as Hogwarts appears above the water."
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
          "Create a detailed walkable first-person hidden railway platform for Platform Nine and Three-Quarters, the secret magical departure platform at King's Cross. The player should stand on a long stone platform with brick pillars forming a corridor, a scarlet steam locomotive along one side, open carriage doors with brass handles, polished train wheels, iron railings, luggage carts, stacked school trunks, bird cages, benches, hanging lamps, and thick drifting steam. Include a brick barrier threshold behind the player, warm carriage light spilling from the train, amber platform lamps cutting through cool white steam, and a strong vanishing point down the platform. Make it spatially explorable with enough ground clearance to walk and clear left/right landmarks. No readable platform signs, no logos, no real-world brand marks, no crowds or characters, no modern objects, no flat wall backdrop, no fisheye distortion.",
        splatUrl: null,
        status: "planned"
      }
    }
  },
  {
    id: "black-lake-arrival",
    title: "Black Lake Arrival",
    summary: "The first years cross the dark lake by boat and see Hogwarts Castle rise above the cliffs for the first time.",
    layoutType: "open_clearing",
    dressing:
      "a cold moonlit lakeshore with small wooden boats, black water, reeds, lantern reflections, wet stones, a boathouse path, and Hogwarts Castle towering above distant cliffs",
    mood: "wonder",
    stylePrompt:
      "moonlit magical lake arrival, small wooden boats, dark reflective water, castle on cliffs, lanterns, mist, first-person walkable cinematic fantasy shoreline",
    narration:
      "The lake is black glass beneath the boats. Ahead, towers and windows climb out of the cliffside, and Hogwarts becomes larger than rumor.",
    sourceAnchors: [
      {
        quote: "Demo beat: the first years approach Hogwarts by boat across the lake.",
        meaning: "This scene gives the demo a cinematic reveal of the castle before moving inside."
      }
    ],
    objects: [
      {
        id: "first-year-boat",
        label: "First-Year Boat",
        visualType: "artifact",
        description: "A small wooden boat rests against the stones, damp from the lake crossing.",
        quote: "Demo beat: first years cross the lake in small boats.",
        explanation: "The boat makes the castle arrival feel like a rite of passage.",
        slot: "left"
      },
      {
        id: "lake-lantern",
        label: "Lake Lantern",
        visualType: "lamp",
        description: "A lantern glows near the waterline, reflected in ripples across the black lake.",
        quote: "Demo beat: lantern light guides the students from water to castle.",
        explanation: "The lantern gives the dark reveal a readable warm focal point.",
        slot: "center"
      },
      {
        id: "castle-path",
        label: "Castle Path",
        visualType: "door",
        description: "A wet stone path climbs from the boats toward the castle entrance.",
        quote: "Demo beat: arrival turns into entry.",
        explanation: "The path connects the exterior reveal to the Great Hall sequence.",
        slot: "right"
      }
    ],
    transitionToNext: {
      label: "Enter the Great Hall",
      description: "The lake mist gives way to candlelight, stone arches, and the Sorting."
    },
    integrations: {
      narration: {
        provider: "elevenlabs",
        script:
          "The boats slide across the Black Lake, quiet except for water against wood. Then the castle appears above the cliffs, bright with windows, impossible and waiting.",
        audioUrl: null
      },
      walkableWorld: {
        provider: "world-labs",
        prompt:
          "Create an impressive walkable first-person magical castle arrival scene on the edge of the Black Lake at night, inspired by the first-years' boat approach to Hogwarts. The player should stand on a wet stone lakeshore or boathouse landing with a clear walkable path from foreground boats toward the castle. Include small old wooden boats pulled up to the shore, black reflective water, reeds, slick stones, rope posts, warm lanterns, drifting lake mist, moonlight, and a towering medieval castle with many lit windows rising on cliffs in the background. The castle should feel vast and vertical, with towers, turrets, bridges, steep roofs, and warm window grids reflected in the water. Use strong foreground/midground/background depth for a Gaussian splat walkthrough, realistic wet stone, dark water, wood, brass lanterns, and cold fog. No readable text, no characters, no modern objects, no logos, no flat backdrop, no fisheye distortion.",
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
      label: "Climb the Grand Staircase",
      description: "The Sorting candles stretch into moving stairs, portraits, and living castle corridors."
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
          "Create a grand walkable first-person magical castle dining hall for the Hogwarts Sorting Ceremony. The space should be a vast stone interior with a clear central aisle, long wooden banquet tables on both sides, benches, brass plates, goblets, candles, towering stone arches, tall leaded windows, hanging house-colored fabric banners with no readable symbols, and an enchanted ceiling that appears as a deep starry night sky. At the far end, include a small wooden stool with an old patched pointed hat resting on it beneath a focused pool of candlelight, plus a raised staff table and carved stone backdrop. Floating candles should hover overhead and create warm golden pools of light with soft shadows on the stone floor. Use strong architectural depth, visible walls, ceiling, floor, and a clear navigable route from entrance to front. No readable text, no logos, no characters, no modern objects, no abstract title-card composition, no flat backdrop.",
        splatUrl: null,
        status: "planned"
      }
    }
  },
  {
    id: "grand-staircase-portraits",
    title: "The Grand Staircase",
    summary: "The castle reveals itself as a living maze of moving stairs, tall portraits, torchlit landings, and impossible vertical space.",
    layoutType: "corridor_path",
    dressing:
      "a towering castle stairwell with moving stone staircases, portrait-covered walls, torch brackets, carved railings, arched landings, and deep vertical shadows",
    mood: "mysterious",
    stylePrompt:
      "magical castle grand staircase, moving stairs, portrait walls, torchlight, tall stone shafts, arched landings, walkable first-person interior fantasy architecture",
    narration:
      "Inside the castle, even the hallways have opinions. Stairs climb, turn, and threaten to become something else while painted eyes follow from every wall.",
    sourceAnchors: [
      {
        quote: "Demo beat: Hogwarts is not just a building; it moves, watches, and rearranges itself.",
        meaning: "This scene showcases the castle as an explorable magical system between the ceremonial hall and the dangerous forest."
      }
    ],
    objects: [
      {
        id: "moving-stair",
        label: "Moving Stair",
        visualType: "artifact",
        description: "A broad stone staircase angles away from the landing as if it has just shifted position.",
        quote: "Demo beat: staircases change inside Hogwarts.",
        explanation: "The angled stair makes the environment feel alive without needing animated characters.",
        slot: "center"
      },
      {
        id: "portrait-wall",
        label: "Portrait Wall",
        visualType: "portrait",
        description: "A dense wall of framed portraits climbs several stories into shadow.",
        quote: "Demo beat: portraits in Hogwarts behave like residents.",
        explanation: "The portrait wall gives the scene lore density and visual scale.",
        slot: "wall"
      },
      {
        id: "torch-landing",
        label: "Torchlit Landing",
        visualType: "lamp",
        description: "A torch bracket burns beside a stone landing that overlooks the stairwell.",
        quote: "Demo beat: old castle light guides students through confusing corridors.",
        explanation: "The torch creates a navigable waypoint and strong warm contrast.",
        slot: "right"
      }
    ],
    transitionToNext: {
      label: "Into the Forbidden Forest",
      description: "Stone stairs and portrait whispers fade into roots, fog, and moonlit trees."
    },
    integrations: {
      narration: {
        provider: "elevenlabs",
        script:
          "The Grand Staircase rises through the castle like a tower of choices. Portraits crowd the walls, torches burn in the stone, and every landing seems to lead somewhere different.",
        audioUrl: null
      },
      walkableWorld: {
        provider: "world-labs",
        prompt:
          "Create a dramatic walkable first-person magical castle stairwell inspired by the Grand Staircase at Hogwarts. The player should stand on a broad stone landing with a clear safe walking area, surrounded by multiple intersecting stone staircases at different heights, carved railings, arched openings, portrait-covered walls, torch brackets, candle sconces, hanging shadows, and deep vertical space above and below. Make the stairs feel as if they could move: angled spans, offset landings, unusual connections, and impossible but physically grounded castle geometry. Include many framed portraits with no readable text and no recognizable faces, warm torchlight against cool gray stone, dust motes, worn steps, and strong parallax from foreground railing to distant upper landings. No characters, no readable signs, no modern objects, no logos, no flat backdrop, no fisheye distortion.",
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
          "Create a tense walkable first-person moonlit Forbidden Forest clearing on the edge of the Hogwarts grounds. The player should stand on a narrow dirt path that opens into a small navigable clearing with twisted ancient tree trunks, exposed roots crossing the path, mossy stones, broken branches, wet leaves, brambles, low blue-gray fog, silver moonlight shafts, and deep black tree silhouettes. Include a half-buried lantern near the trail, a faint warm castle glow far behind the trees, and subtle magical traces such as pale silver light on leaves and a small protective glow in the clearing. Build strong foreground roots, midground clearing details, and background tree density for deep spatial parallax in a Gaussian splat. Dangerous but beautiful, cool moonlight with small warm lantern contrast. No characters, no creatures, no readable text, no logos, no modern objects, no flat painted backdrop, no fisheye distortion.",
        splatUrl: null,
        status: "planned"
      }
    }
  }
];
