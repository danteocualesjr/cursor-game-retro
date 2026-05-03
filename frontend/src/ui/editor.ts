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
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
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
