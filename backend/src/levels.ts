/**
 * Slim mirror of the level metadata, server-side. Only the bits the tutor
 * needs to know about (no grids - the agent only cares about the kid's code
 * and the level intent).
 */
export interface LevelMeta {
  id: number;
  name: string;
  intro: string;
  allowedCommands: string[];
}

export const LEVELS: LevelMeta[] = [
  {
    id: 1,
    name: "First Steps",
    intro: "Move forward to reach the glowing goal tile.",
    allowedCommands: ["move"],
  },
  {
    id: 2,
    name: "About Face",
    intro: "Walk forward, turn, and walk again to reach the corner goal.",
    allowedCommands: ["move", "turnLeft", "turnRight"],
  },
  {
    id: 3,
    name: "Around Again",
    intro: "Walk a square loop using repeat(n) { ... } to reach the goal.",
    allowedCommands: ["move", "turnLeft", "turnRight", "repeat"],
  },
  {
    id: 4,
    name: "Shiny Things",
    intro:
      "Walk forward and pick up every gem. Use here(\"gem\") to check the tile under the hero.",
    allowedCommands: ["move", "turnLeft", "turnRight", "repeat", "pickUp", "if"],
  },
  {
    id: 5,
    name: "Heave-Ho",
    intro: "Push a wooden crate onto the green switch using push().",
    allowedCommands: ["move", "turnLeft", "turnRight", "repeat", "push"],
  },
  {
    id: 6,
    name: "Gem Sweep",
    intro:
      "Walk a long row, picking up gems wherever you find them. Use repeat + if(here(\"gem\")).",
    allowedCommands: [
      "move",
      "turnLeft",
      "turnRight",
      "repeat",
      "pickUp",
      "if",
    ],
  },
  {
    id: 7,
    name: "Slime Time",
    intro: "Defeat the slime. Pushing a crate onto a slime squishes it.",
    allowedCommands: [
      "move",
      "turnLeft",
      "turnRight",
      "repeat",
      "push",
      "attack",
      "if",
    ],
  },
  {
    id: 8,
    name: "Free Play",
    intro:
      "Combine everything: pick up every gem in a multi-room maze. while(sees(\"open\")) is your friend.",
    allowedCommands: [
      "move",
      "turnLeft",
      "turnRight",
      "repeat",
      "pickUp",
      "push",
      "attack",
      "if",
      "while",
    ],
  },
];
