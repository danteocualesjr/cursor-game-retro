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
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import { tags as t } from "@lezer/highlight";
import { parse, ParseError } from "../game/interpreter";
import { DSL_SNIPPETS, snippetFor } from "../game/dsl-snippets";
import { formatDsl } from "../game/format";

/**
 * Lint the buffer with the same parse() the runtime uses, so the kid sees
 * red squiggles + a gutter dot the moment they type a typo, instead of
 * having to click RUN to find out. We deliberately surface ONE error at a
 * time: the parser is recursive-descent and bails on the first bad token.
 */
function dslLinter(view: EditorView): Diagnostic[] {
  const doc = view.state.doc;
  const code = doc.toString();
  if (code.trim() === "") return [];
  try {
    parse(code);
    return [];
  } catch (e) {
    if (!(e instanceof ParseError)) return [];
    const lineNo = Math.min(Math.max(1, e.line), doc.lines);
    const line = doc.line(lineNo);
    // Highlight from the reported column to the next whitespace (or end of
    // line) so the user can see exactly which token tripped the parser.
    const colIdx = Math.min(Math.max(0, e.col - 1), line.length);
    const fromAbs = line.from + colIdx;
    const text = line.text;
    let endCol = colIdx;
    while (endCol < text.length && /[A-Za-z0-9_"'(){};]/.test(text[endCol])) {
      endCol++;
    }
    if (endCol === colIdx) endCol = Math.min(text.length, colIdx + 1);
    const toAbs = Math.max(fromAbs + 1, line.from + endCol);
    return [
      {
        from: fromAbs,
        to: toAbs,
        severity: "error",
        message: e.message.replace(/^Line \d+:\s*/, ""),
        source: "Codequest",
      },
    ];
  }
}

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

function dslCompletions(ctx: CompletionContext): CompletionResult | null {
  const word = ctx.matchBefore(/[A-Za-z_]\w*/);
  if (!word) return null;
  if (word.from === word.to && !ctx.explicit) return null;

  const options: Completion[] = DSL_SNIPPETS.map((c) => ({
    label: c.label,
    detail: c.detail,
    info: c.info,
    type: c.kind === "keyword" ? "keyword" : "function",
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

/* Editor highlight tuned for the 80s neon background:
   keywords = hot magenta, functions = neon yellow, sensors and
   strings = electric cyan, numbers = NES green, comments = dim
   cyan-grey. Reads clearly on #100620 editor background. */
const retroHighlight = HighlightStyle.define([
  { tag: t.keyword, color: "#ff2e88", fontWeight: "bold" },
  { tag: t.controlKeyword, color: "#ff2e88", fontWeight: "bold" },
  { tag: t.function(t.variableName), color: "#ffea00" },
  { tag: t.number, color: "#39ff14" },
  { tag: t.string, color: "#00f0ff" },
  { tag: t.comment, color: "#5a7a8a", fontStyle: "italic" },
  { tag: t.operator, color: "#ff66d9" },
  { tag: t.bracket, color: "#ff66d9" },
  { tag: t.variableName, color: "#f0f4ff" },
]);

export class CodeEditor {
  view: EditorView;
  private editable = new Compartment();

  constructor(parent: HTMLElement, initial: string) {
    const state = EditorState.create({
      doc: initial,
      extensions: [
        lineNumbers(),
        lintGutter(),
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
        linter(dslLinter, { delay: 350 }),
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

  /**
   * Re-indent the buffer using two-space steps based on `{` / `}` nesting,
   * after collapsing runs of blank lines and trimming trailing whitespace.
   * Strings (single- or double-quoted) and `//` line comments are preserved
   * verbatim so they don't trigger fake brace nesting.
   *
   * Returns true if the document changed, false if it was already tidy.
   */
  tidy(): boolean {
    const before = this.getCode();
    const after = formatDsl(before);
    if (after === before) return false;
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: after },
    });
    return true;
  }

  /**
   * Insert a DSL snippet at the current cursor position. If the cursor is
   * mid-line, prefixes a newline so the snippet starts cleanly on its own
   * line. Cursor lands at the snippet's natural fill point. Returns true
   * on success, false if the snippet name is unknown.
   */
  insertSnippet(name: string): boolean {
    const snip = snippetFor(name);
    if (!snip) return false;
    const view = this.view;
    const sel = view.state.selection.main;
    const from = sel.from;
    const to = sel.to;
    const lineAtFrom = view.state.doc.lineAt(from);
    const before = view.state.doc.sliceString(lineAtFrom.from, from);
    const needsNewline = before.trim().length > 0;
    const insert = (needsNewline ? "\n" : "") + snip.apply;
    const cursorEnd = from + insert.length;
    const cursor =
      snip.cursorOffsetFromEnd !== undefined
        ? cursorEnd - snip.cursorOffsetFromEnd
        : cursorEnd;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: cursor },
    });
    view.focus();
    return true;
  }

  destroy() {
    this.view.destroy();
  }
}
