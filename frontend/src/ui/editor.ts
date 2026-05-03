import { EditorState, Compartment, StateEffect, StateField } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  Decoration,
  type DecorationSet,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  bracketMatching,
  indentOnInput,
  HighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import {
  autocompletion,
  completionKeymap,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { tags as t } from "@lezer/highlight";

const setExecLine = StateEffect.define<number | null>();

const execLineMark = Decoration.line({
  attributes: { class: "cm-execLine" },
});

const execLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setExecLine)) {
        const ln = e.value;
        if (ln === null) {
          deco = Decoration.none;
        } else if (ln >= 1 && ln <= tr.state.doc.lines) {
          const line = tr.state.doc.line(ln);
          deco = Decoration.set([execLineMark.range(line.from)]);
        } else {
          deco = Decoration.none;
        }
      }
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/**
 * DSL completions. The label shows in the popup; apply is a snippet-style
 * string that gets inserted (we keep it simple: insert the call shell with
 * the cursor positioned at the inside-paren when there's an arg slot).
 */
const DSL_COMPLETIONS: ReadonlyArray<{
  label: string;
  detail: string;
  info: string;
  apply: string;
  cursorOffsetFromEnd?: number;
}> = [
  { label: "move", detail: "move(n)", info: "Walk n tiles forward.", apply: "move(1)", cursorOffsetFromEnd: 1 },
  { label: "turnLeft", detail: "turnLeft()", info: "Rotate 90 degrees counter-clockwise.", apply: "turnLeft()" },
  { label: "turnRight", detail: "turnRight()", info: "Rotate 90 degrees clockwise.", apply: "turnRight()" },
  { label: "pickUp", detail: "pickUp()", info: "Pick up a gem on the hero's tile.", apply: "pickUp()" },
  { label: "push", detail: "push()", info: "Shove the tile in front by one.", apply: "push()" },
  { label: "attack", detail: "attack()", info: "Hit a slime in front of the hero.", apply: "attack()" },
  { label: "wait", detail: "wait()", info: "Do nothing for a beat.", apply: "wait()" },
  {
    label: "repeat",
    detail: "repeat(n) { ... }",
    info: "Run the body n times.",
    apply: "repeat(3) {\n  \n}",
    cursorOffsetFromEnd: 3,
  },
  {
    label: "if",
    detail: 'if (sees("X")) { ... }',
    info: 'Run the body when the sensor is true. X = gem|wall|crate|slime|switch|goal|open',
    apply: 'if (sees("gem")) {\n  \n}',
    cursorOffsetFromEnd: 3,
  },
  {
    label: "while",
    detail: 'while (sees("X")) { ... }',
    info: "Loop while the sensor stays true.",
    apply: 'while (sees("open")) {\n  \n}',
    cursorOffsetFromEnd: 3,
  },
  { label: "sees", detail: 'sees("X")', info: "True if X is in the tile in front of the hero.", apply: 'sees("gem")' },
  { label: "here", detail: 'here("X")', info: "True if X is on the tile the hero is standing on.", apply: 'here("gem")' },
];

function dslCompletions(ctx: CompletionContext): CompletionResult | null {
  const word = ctx.matchBefore(/[A-Za-z_]\w*/);
  if (!word) return null;
  if (word.from === word.to && !ctx.explicit) return null;

  const options: Completion[] = DSL_COMPLETIONS.map((c) => ({
    label: c.label,
    detail: c.detail,
    info: c.info,
    type: c.label === "if" || c.label === "while" || c.label === "repeat" ? "keyword" : "function",
    apply: (view, _completion, from, to) => {
      const insert = c.apply;
      const cursor =
        c.cursorOffsetFromEnd !== undefined
          ? from + insert.length - c.cursorOffsetFromEnd
          : from + insert.length;
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: cursor },
      });
    },
  }));

  return { from: word.from, options, validFor: /^[A-Za-z_]\w*$/ };
}

const retroHighlight = HighlightStyle.define([
  { tag: t.keyword, color: "#ff66aa", fontWeight: "bold" },
  { tag: t.controlKeyword, color: "#ff66aa", fontWeight: "bold" },
  { tag: t.function(t.variableName), color: "#ffd633" },
  { tag: t.number, color: "#66ff99" },
  { tag: t.string, color: "#66ccff" },
  { tag: t.comment, color: "#7a7aaf", fontStyle: "italic" },
  { tag: t.operator, color: "#cc99ff" },
  { tag: t.bracket, color: "#cc99ff" },
  { tag: t.variableName, color: "#f4f4ff" },
]);

export class CodeEditor {
  view: EditorView;
  private editable = new Compartment();

  constructor(parent: HTMLElement, initial: string) {
    const state = EditorState.create({
      doc: initial,
      extensions: [
        lineNumbers(),
        history(),
        bracketMatching(),
        indentOnInput(),
        highlightActiveLine(),
        javascript(),
        syntaxHighlighting(retroHighlight),
        execLineField,
        autocompletion({
          override: [dslCompletions],
          activateOnTyping: true,
          icons: false,
        }),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        this.editable.of(EditorView.editable.of(true)),
      ],
    });
    this.view = new EditorView({ state, parent });
  }

  getCode(): string {
    return this.view.state.doc.toString();
  }

  setCode(text: string) {
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: text },
    });
  }

  setEditable(enabled: boolean) {
    this.view.dispatch({
      effects: this.editable.reconfigure(EditorView.editable.of(enabled)),
    });
  }

  /** Highlight the source line currently being executed (1-indexed), or
   *  pass null to clear. */
  setExecutingLine(line: number | null) {
    this.view.dispatch({ effects: setExecLine.of(line) });
  }

  destroy() {
    this.view.destroy();
  }
}
