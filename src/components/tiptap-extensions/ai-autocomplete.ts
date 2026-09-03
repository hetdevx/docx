import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export type AIAutocompleteOptions = {
  fetchSuggestion: (context: string, signal: AbortSignal) => Promise<string>;
  debounceMs: number;
  minContextLength: number;
};

type PluginState = { suggestion: string | null; pos: number | null };

const aiAutocompleteKey = new PluginKey<PluginState>("aiAutocomplete");

/**
 * Copilot/Notion-AI style ghost-text: after a pause in typing, fetches a
 * short continuation and renders it as an inline, non-editable widget right
 * after the cursor. Tab inserts it, any other edit or cursor move discards
 * it (see the plugin's `apply` below — anything other than our own "set"
 * meta transaction clears the suggestion).
 */
export const AIAutocomplete = Extension.create<AIAutocompleteOptions>({
  name: "aiAutocomplete",

  addOptions() {
    return {
      fetchSuggestion: async () => "",
      debounceMs: 700,
      minContextLength: 8,
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    const editor = this.editor;

    return [
      new Plugin<PluginState>({
        key: aiAutocompleteKey,

        state: {
          init: () => ({ suggestion: null, pos: null }),
          apply(tr, value) {
            const meta = tr.getMeta(aiAutocompleteKey);
            if (meta?.type === "set") return { suggestion: meta.suggestion, pos: meta.pos };
            if (meta?.type === "clear") return { suggestion: null, pos: null };
            if (tr.docChanged) return { suggestion: null, pos: null };
            if (value.suggestion !== null && tr.selectionSet && tr.selection.from !== value.pos) {
              return { suggestion: null, pos: null };
            }
            return value;
          },
        },

        props: {
          decorations(state) {
            const pluginState = aiAutocompleteKey.getState(state);
            if (!pluginState?.suggestion || pluginState.pos == null) return null;

            return DecorationSet.create(state.doc, [
              Decoration.widget(
                pluginState.pos,
                () => {
                  const span = document.createElement("span");
                  span.className = "ai-ghost";
                  span.textContent = pluginState.suggestion ?? "";
                  span.setAttribute("contenteditable", "false");
                  span.title = "Press Tab to accept";
                  return span;
                },
                { side: 1 },
              ),
            ]);
          },

          handleKeyDown(view, event) {
            const pluginState = aiAutocompleteKey.getState(view.state);
            if (!pluginState?.suggestion || pluginState.pos == null) return false;

            if (event.key === "Tab") {
              event.preventDefault();
              view.dispatch(view.state.tr.insertText(pluginState.suggestion, pluginState.pos));
              return true;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              view.dispatch(view.state.tr.setMeta(aiAutocompleteKey, { type: "clear" }));
              return true;
            }
            return false;
          },
        },

        view() {
          let timer: ReturnType<typeof setTimeout> | null = null;
          let controller: AbortController | null = null;

          function clearTimer() {
            if (timer) {
              clearTimeout(timer);
              timer = null;
            }
          }

          function abortInFlight() {
            controller?.abort();
            controller = null;
          }

          return {
            update(view, prevState) {
              if (!editor.isEditable) return;
              if (view.state.doc.eq(prevState.doc) && view.state.selection.eq(prevState.selection)) {
                return;
              }

              clearTimer();
              abortInFlight();

              const { selection } = view.state;
              if (!selection.empty) return;

              const pos = selection.from;

              timer = setTimeout(() => {
                const context = view.state.doc.textBetween(0, pos, "\n", "\n");
                if (context.trim().length < options.minContextLength) return;

                controller = new AbortController();
                const { signal } = controller;

                options
                  .fetchSuggestion(context, signal)
                  .then((suggestion) => {
                    if (signal.aborted || !suggestion) return;
                    const current = view.state.selection;
                    if (!current.empty || current.from !== pos) return;

                    view.dispatch(
                      view.state.tr.setMeta(aiAutocompleteKey, { type: "set", suggestion, pos }),
                    );
                  })
                  .catch(() => {
                    // Aborted or network error — ghost text is best-effort.
                  });
              }, options.debounceMs);
            },
            destroy() {
              clearTimer();
              abortInFlight();
            },
          };
        },
      }),
    ];
  },
});
