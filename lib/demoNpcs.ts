export type DemoNpc = {
  id: string;
  name: string;
  role: string;
  portrait: string;
  tagline: string;
  position: [number, number, number];
  scale: number;
  rotationY: number;
  lines: string[];
};

export type DemoNpcPlacement = {
  id: string;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
};

export const NPC_INTERACTION_RADIUS = 2.4;
export const DEFAULT_NPC_SCALE = 0.85;

export const DEMO_NPCS: DemoNpc[] = [
  {
    id: "harry-potter",
    name: "Harry Potter",
    role: "The Boy Who Lived",
    portrait: "/portraits/sleuth/harry-potter.png",
    tagline: "Honest, brave, and still learning what magic costs.",
    position: [0.0, 0, -5.0],
    scale: 0.97,
    rotationY: Math.PI,
    lines: [
      "I still can't believe any of this is real.",
      "Hagrid told me I'm a wizard. A wizard! Me.",
      "If you see Ron or Hermione, tell them I'll be at the library.",
    ],
  },
  {
    id: "hermione-granger",
    name: "Hermione Granger",
    role: "Top of the class",
    portrait: "/portraits/sleuth/hermione-granger.png",
    tagline: "Reads three books before breakfast. Will correct your wand grip.",
    position: [-1.5, 0, -4.5],
    scale: 0.97,
    rotationY: Math.PI,
    lines: [
      "Have you read Hogwarts: A History yet? I've read it twice.",
      "We've got Charms next, and I refuse to be late again.",
      "If you're stuck on the Levitation Charm, it's wing-GAR-dium leviOH-sa.",
    ],
  },
  {
    id: "draco-malfoy",
    name: "Draco Malfoy",
    role: "Slytherin heir",
    portrait: "/portraits/sleuth/draco-malfoy.png",
    tagline: "Sharp tongue, sharper grudge, sharpest robes in the corridor.",
    position: [3.0, 0, -6.5],
    scale: 0.97,
    rotationY: Math.PI,
    lines: [
      "You'd better watch yourself around here.",
      "My father will hear about this, you know.",
      "Stay out of my way and we won't have a problem.",
    ],
  },
  {
    id: "luna-lovegood",
    name: "Luna Lovegood",
    role: "Ravenclaw dreamer",
    portrait: "/portraits/sleuth/luna-lovegood.png",
    tagline: "Sees what others miss. Talks to the air, and sometimes it answers.",
    position: [-3.0, 0, -6.5],
    scale: 0.97,
    rotationY: Math.PI,
    lines: [
      "Oh, hello. The Wrackspurts are quite thick around you today.",
      "Daddy says the Crumple-Horned Snorkack has been spotted in Sweden.",
      "Don't worry. Things we lose have a way of coming back to us.",
    ],
  },
  {
    id: "severus-snape",
    name: "Severus Snape",
    role: "Potions Master",
    portrait: "/portraits/sleuth/severus-snape.png",
    tagline: "Patience worn thin. Stand at attention or stand outside.",
    position: [1.5, 0, -4.5],
    scale: 0.97,
    rotationY: Math.PI,
    lines: [
      "Stand still. I dislike repeating myself.",
      "Five points from Gryffindor for breathing in my corridor.",
      "If you must speak, speak briefly. I have essays to mark.",
    ],
  },
];

// 4 fixed slots around the player spawn (player stands at x=0, z=2.5, looks toward -z).
// Two NPCs to the left, two to the right — none directly in front, so the player has
// a clear forward path. Each is pre-rotated to face the spawn.
// The WorldViewer raycast-snaps each NPC's y onto the actual collider floor.
const SPAWN_X = 0;
const SPAWN_Z = 2.5;
const facingFromSpawn = (x: number, z: number) => Math.atan2(SPAWN_X - x, SPAWN_Z - z);

export const DEMO_NPC_SLOTS: Array<{
  position: [number, number, number];
  rotationY: number;
}> = [
  // front-left
  { position: [-0.75, 0, -1.5], rotationY: facingFromSpawn(-0.75, -1.5) },
  // front-right
  { position: [0.75, 0, -1.5], rotationY: facingFromSpawn(0.75, -1.5) },
  // more-front-left (same leftness, further forward)
  { position: [-0.75, 0, -3.5], rotationY: facingFromSpawn(-0.75, -3.5) },
  // more-front-right (same rightness, further forward)
  { position: [0.75, 0, -3.5], rotationY: facingFromSpawn(0.75, -3.5) },
];

export function rosterForPlayer(playerCharacterId: string | null | undefined): DemoNpc[] {
  return DEMO_NPCS.filter((npc) => npc.id !== playerCharacterId).slice(0, DEMO_NPC_SLOTS.length);
}
