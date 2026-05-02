import type { ScenePlan } from "./sceneSchema";

export const demoScenes: ScenePlan[] = [
  {
    id: "archive-arrival",
    title: "The Archive Wakes",
    summary: "A document becomes a room of first clues, each object holding a fragment of the source.",
    layoutType: "interior_room",
    dressing: "a lamplit archive room with paper dust in the air, walnut shelves, and a central reading table",
    mood: "mysterious",
    stylePrompt:
      "cinematic lamplit archive room, old paper, glowing annotations, compact explorable story museum",
    narration:
      "The first page settles into walls and shelves. The room feels as if it was built from the margins of a remembered book.",
    sourceAnchors: [
      {
        quote: "Upload a PDF and walk through its story as a chain of interactive 3D scenes.",
        meaning: "The demo promise becomes the entry scene."
      }
    ],
    objects: [
      {
        id: "open-book",
        label: "Open Book",
        visualType: "book",
        description: "A book on the central table glows around a marked sentence.",
        quote: "The user should feel: I am inside the PDF.",
        explanation: "This sentence defines the emotional target: immersion over summary.",
        slot: "table"
      },
      {
        id: "margin-letter",
        label: "Margin Letter",
        visualType: "letter",
        description: "A thin sheet leans against the back wall with ink still moving.",
        quote: "The project is NOT a PDF summarizer.",
        explanation: "The scene rejects a reading-only experience and points toward exploration.",
        slot: "wall"
      },
      {
        id: "brass-key",
        label: "Brass Key",
        visualType: "key",
        description: "A small key rests near the door, warm with borrowed light.",
        quote: "One exit portal, door, path, or threshold to move to the next scene.",
        explanation: "Every scene needs a spatial transition, not just a next button.",
        slot: "left"
      }
    ],
    transitionToNext: {
      label: "Threshold of Pages",
      description: "A glowing door opens into a path made from turning pages."
    }
  },
  {
    id: "memory-platform",
    title: "The Long Passage",
    summary: "The document becomes a linear walk where ideas appear as landmarks along the way.",
    layoutType: "corridor_path",
    dressing: "a foggy train platform at night with flickering lamps, benches, and a distant clock tower",
    mood: "melancholic",
    stylePrompt:
      "foggy night train platform, flickering lamps, memory corridor, distant clock tower, interactive objects glowing",
    narration:
      "The pages stretch into a platform. Each step forward turns structure into distance, and distance into memory.",
    sourceAnchors: [
      {
        quote: "If the document is fiction, make scenes correspond to narrative beats.",
        meaning: "Linear movement suits story progression."
      }
    ],
    objects: [
      {
        id: "station-clock",
        label: "Station Clock",
        visualType: "clock",
        description: "A clock ticks above the platform without choosing a final hour.",
        quote: "Generate 3 scenes max.",
        explanation: "A time-boxed hackathon demo needs a short, memorable chain.",
        slot: "back"
      },
      {
        id: "platform-sign",
        label: "Platform Sign",
        visualType: "sign",
        description: "A sign names the scene as a passage rather than a slide.",
        quote: "Do not make this feel like a slideshow.",
        explanation: "The player should navigate between beats physically.",
        slot: "right"
      },
      {
        id: "ticket-orb",
        label: "Ticket of Memory",
        visualType: "memory_orb",
        description: "A small orb floats where a ticket should be.",
        quote: "Prefer concrete visual objects over abstract ideas.",
        explanation: "The orb stands in for transformation: idea into prop.",
        slot: "left"
      }
    ],
    transitionToNext: {
      label: "Last Platform Light",
      description: "A rectangle of light at the end of the platform leads into an exhibit space."
    }
  },
  {
    id: "gallery-of-proof",
    title: "Gallery of Proof",
    summary: "The final room gathers concepts as exhibits with quotes, meaning, and atmosphere.",
    layoutType: "exhibit_space",
    dressing:
      "a quiet black-floor gallery with low pedestals, a timeline wall, glowing plaques, and a soft blue exit portal",
    mood: "wonder",
    stylePrompt:
      "quiet futuristic story museum gallery, low pedestals, quote plaques, timeline wall, luminous artifacts",
    narration:
      "At the end, the document stops being flat. It becomes a small museum of things that mattered.",
    sourceAnchors: [
      {
        quote: "The app should feel like an explorable story museum / playable memory palace.",
        meaning: "The final scene makes the product metaphor explicit through space."
      }
    ],
    objects: [
      {
        id: "quote-plaque",
        label: "Quote Plaque",
        visualType: "portrait",
        description: "A framed quote glows on the timeline wall.",
        quote: "Each object should have: source-grounded quote or excerpt from the PDF.",
        explanation: "The interaction panel must stay anchored to document text.",
        slot: "wall"
      },
      {
        id: "museum-artifact",
        label: "Museum Artifact",
        visualType: "artifact",
        description: "A faceted object rotates slowly above a pedestal.",
        quote: "Use layout archetypes, not literal fixed environment templates.",
        explanation: "Reliable geometry keeps the demo stable while the story dressing changes.",
        slot: "center"
      },
      {
        id: "blue-lamp",
        label: "Blue Lamp",
        visualType: "lamp",
        description: "A lamp casts a circle of color around the exit.",
        quote: "Prioritize atmosphere.",
        explanation: "Lighting and mood make a primitive scene feel intentional.",
        slot: "right"
      }
    ],
    transitionToNext: {
      label: "Close the PDF",
      description: "The last portal returns you to the generated scene cards."
    }
  }
];

