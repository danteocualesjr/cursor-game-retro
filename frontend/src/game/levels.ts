import type { LevelSpec } from "./grid";

export const LEVELS: LevelSpec[] = [
  {
    id: 1,
    name: "First Steps",
    intro:
      "Move forward to reach the glowing goal tile. The hero is facing right.",
    starterCode: "// Make the hero walk to the goal!\nmove(1);\n",
    allowedCommands: ["move"],
    grid: [
      "W W W W W W W W",
      "W H . . . . G W",
      "W W W W W W W W",
    ].join("\n"),
    goal: { kind: "reach", x: 6, y: 1 },
  },
  {
    id: 2,
    name: "About Face",
    intro:
      "The goal is around the corner. Use turnRight() to face a new direction, then keep moving.",
    starterCode:
      "// Try: move(4); turnRight(); move(3);\nmove(4);\nturnRight();\nmove(3);\n",
    allowedCommands: ["move", "turnLeft", "turnRight"],
    grid: [
      "W W W W W W W",
      "W H . . . . W",
      "W . . . . . W",
      "W . . . . . W",
      "W . . . . G W",
      "W W W W W W W",
    ].join("\n"),
    goal: { kind: "reach", x: 5, y: 4 },
  },
  {
    id: 3,
    name: "Around Again",
    intro:
      "Walk around the loop to reach the goal. Try repeat(4) { ... } so you don't write the same code over and over.",
    starterCode:
      "// Each side of the loop is the same!\nrepeat(4) {\n  move(5);\n  turnRight();\n}\n",
    allowedCommands: ["move", "turnLeft", "turnRight", "repeat"],
    grid: [
      "W W W W W W W W",
      "W H . . . . . W",
      "W . W W W W . W",
      "W . W . . W . W",
      "W . W . . W . W",
      "W . W W W W . W",
      "W . . . . . G W",
      "W W W W W W W W",
    ].join("\n"),
    goal: { kind: "reach", x: 6, y: 6 },
  },
  {
    id: 4,
    name: "Shiny Things",
    intro:
      "Walk forward and pick up every gem along the path. Use here(\"gem\") to check if you're standing on one.",
    starterCode:
      "// Tip: here(\"gem\") is true when you're STANDING on a gem.\nrepeat(6) {\n  move(1);\n  if (here(\"gem\")) {\n    pickUp();\n  }\n}\n",
    allowedCommands: ["move", "turnLeft", "turnRight", "repeat", "pickUp", "if"],
    grid: [
      "W W W W W W W W W",
      "W H g . g g . . W",
      "W W W W W W W W W",
    ].join("\n"),
    goal: { kind: "collect-all" },
  },
  {
    id: 5,
    name: "Heave-Ho",
    intro:
      "Push the wooden crate onto the green switch. push() shoves whatever is in front of you forward by one.",
    starterCode: "// Push the crate three times.\nrepeat(3) {\n  push();\n}\n",
    allowedCommands: ["move", "turnLeft", "turnRight", "repeat", "push"],
    grid: [
      "W W W W W W W",
      "W . . . . . W",
      "W . . . . . W",
      "W H c . . s W",
      "W . . . . . W",
      "W W W W W W W",
    ].join("\n"),
    goal: { kind: "switches" },
  },
  {
    id: 6,
    name: "Gem Sweep",
    intro:
      "There's a long row of tiles, but only some have gems. Combine repeat with if(here(\"gem\")) to grab them all.",
    starterCode:
      "// Walk all the way across and grab any gem you stand on.\nrepeat(11) {\n  move(1);\n  if (here(\"gem\")) {\n    pickUp();\n  }\n}\n",
    allowedCommands: [
      "move",
      "turnLeft",
      "turnRight",
      "repeat",
      "pickUp",
      "if",
    ],
    grid: [
      "W W W W W W W W W W W W W",
      "W H g . g . g g . . g . W",
      "W W W W W W W W W W W W W",
    ].join("\n"),
    goal: { kind: "collect-all" },
  },
  {
    id: 7,
    name: "Slime Time",
    intro:
      "A slime is blocking the path! Push the crate forward to squish it, then walk to the goal.",
    starterCode:
      "// First squish the slime by pushing the crate.\npush();\npush();\nmove(2);\n",
    allowedCommands: [
      "move",
      "turnLeft",
      "turnRight",
      "repeat",
      "push",
      "attack",
      "if",
    ],
    grid: [
      "W W W W W W W W",
      "W H c . m . G W",
      "W W W W W W W W",
    ].join("\n"),
    goal: { kind: "defeat-all" },
  },
  {
    id: 8,
    name: "Free Play",
    intro:
      "Last quest! Grab every gem and squish every slime. Combine everything you've learned.",
    starterCode:
      "// You decide. Try repeat, if, push, attack, pickUp, move, turn...\n// Hint: while(...) keeps looping while a sensor is true.\nwhile (sees(\"open\")) {\n  move(1);\n  if (here(\"gem\")) { pickUp(); }\n}\n",
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
    grid: [
      "W W W W W W W W W W",
      "W H . g . . g . . W",
      "W W W W W W W . W W",
      "W . g . . . . . . W",
      "W . W W W W W W W W",
      "W . . . . g . . G W",
      "W W W W W W W W W W",
    ].join("\n"),
    goal: { kind: "collect-all" },
  },
];

export function levelById(id: number): LevelSpec {
  const lvl = LEVELS.find((l) => l.id === id);
  if (!lvl) throw new Error(`No level with id ${id}`);
  return lvl;
}
