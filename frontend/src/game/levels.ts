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
    parSteps: 5,
    exampleSolution: "// Walk five tiles to the goal.\nmove(5);\n",
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
    parSteps: 8,
    exampleSolution:
      "// Walk forward, turn the corner, walk again.\nmove(4);\nturnRight();\nmove(3);\n",
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
    parSteps: 24,
    exampleSolution:
      "// Each side of the loop is the same: walk 5, turn right.\nrepeat(4) {\n  move(5);\n  turnRight();\n}\n",
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
    parSteps: 9,
    exampleSolution:
      "// Walk the row; if a gem is under your feet, pick it up.\nrepeat(6) {\n  move(1);\n  if (here(\"gem\")) {\n    pickUp();\n  }\n}\n",
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
    parSteps: 3,
    exampleSolution:
      "// Push the crate three tiles onto the switch.\nrepeat(3) {\n  push();\n}\n",
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
    parSteps: 16,
    exampleSolution:
      "// One walk, one peek, one pickup - eleven times.\nrepeat(11) {\n  move(1);\n  if (here(\"gem\")) {\n    pickUp();\n  }\n}\n",
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
    parSteps: 3,
    exampleSolution:
      "// Two pushes squish the slime; then walk to the goal.\npush();\npush();\nmove(2);\n",
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
    parSteps: 32,
    exampleSolution:
      "// Snake through the maze: row 1, drop down, row 3, drop down, row 5.\nrepeat(7) {\n  move(1);\n  if (here(\"gem\")) { pickUp(); }\n}\nturnRight();\nmove(2);\nturnRight();\nrepeat(7) {\n  move(1);\n  if (here(\"gem\")) { pickUp(); }\n}\nturnLeft();\nmove(2);\nturnLeft();\nrepeat(8) {\n  move(1);\n  if (here(\"gem\")) { pickUp(); }\n}\n",
  },
];

export function levelById(id: number): LevelSpec {
  const lvl = LEVELS.find((l) => l.id === id);
  if (!lvl) throw new Error(`No level with id ${id}`);
  return lvl;
}
