import { Extension, type CommandProps } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    search: {
      setSearchQuery: (query: string, caseSensitive?: boolean) => ReturnType;
      findNext: () => ReturnType;
      findPrevious: () => ReturnType;
      replaceMatch: (replacement: string) => ReturnType;
      replaceAllMatches: (replacement: string) => ReturnType;
    };
  }
}

interface Match {
  from: number;
  to: number;
}

export interface SearchState {
  query: string;
  caseSensitive: boolean;
  matches: Match[];
  /** The current match, or -1 when there is none. */
  index: number;
}

export const searchKey = new PluginKey<SearchState>("search");

/** Matches of the query, within segments (never across them). */
function findMatches(doc: ProseMirrorNode, query: string, caseSensitive: boolean): Match[] {
  if (!query) return [];
  const fold = (value: string) => (caseSensitive ? value : value.toLocaleLowerCase());
  const needle = fold(query);
  const matches: Match[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== "segment") return true;
    const text = fold(node.textContent);
    for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + needle.length)) {
      matches.push({ from: pos + 1 + at, to: pos + 1 + at + needle.length });
    }
    return false;
  });
  return matches;
}

function withIndex(state: SearchState, index: number): SearchState {
  const count = state.matches.length;
  return { ...state, index: count ? ((index % count) + count) % count : -1 };
}

export function getSearchState(state: EditorState): SearchState {
  return searchKey.getState(state) ?? { query: "", caseSensitive: false, matches: [], index: -1 };
}

export const Search = Extension.create({
  name: "search",

  addCommands() {
    const step =
      (delta: number) =>
      ({ state, tr, dispatch }: CommandProps) => {
        const search = getSearchState(state);
        if (!search.matches.length) return false;
        if (dispatch) {
          const next = withIndex(search, search.index + delta);
          const match = next.matches[next.index];
          tr.setMeta(searchKey, { index: next.index })
            .setSelection(TextSelection.create(tr.doc, match.from, match.to))
            .scrollIntoView();
        }
        return true;
      };

    return {
      setSearchQuery:
        (query, caseSensitive = false) =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(searchKey, { query, caseSensitive });
          return true;
        },
      findNext: () => step(1),
      findPrevious: () => step(-1),
      replaceMatch:
        (replacement) =>
        ({ state, tr, dispatch }) => {
          const { matches, index } = getSearchState(state);
          const match = matches[index];
          if (!match) return false;
          if (dispatch) {
            if (replacement) tr.insertText(replacement, match.from, match.to);
            else tr.delete(match.from, match.to);
            // Stay on the same index, which is now the following match.
            tr.setMeta(searchKey, { index });
          }
          return true;
        },
      replaceAllMatches:
        (replacement) =>
        ({ state, tr, dispatch }) => {
          const { matches } = getSearchState(state);
          if (!matches.length) return false;
          if (dispatch) {
            for (const match of [...matches].reverse()) {
              if (replacement) tr.insertText(replacement, match.from, match.to);
              else tr.delete(match.from, match.to);
            }
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: () => ({ query: "", caseSensitive: false, matches: [], index: -1 }),
          apply: (tr, value, _old, state) => {
            const meta = tr.getMeta(searchKey) as Partial<SearchState> | undefined;
            const query = meta?.query ?? value.query;
            const caseSensitive = meta?.caseSensitive ?? value.caseSensitive;
            if (meta?.query === undefined && !tr.docChanged) {
              return meta?.index === undefined ? value : withIndex(value, meta.index);
            }
            const matches = findMatches(state.doc, query, caseSensitive);
            const index = meta?.index ?? (meta?.query !== undefined ? 0 : value.index);
            return withIndex({ query, caseSensitive, matches, index }, Math.max(index, 0));
          },
        },
        props: {
          decorations(state) {
            const { matches, index } = getSearchState(state);
            if (!matches.length) return DecorationSet.empty;
            return DecorationSet.create(
              state.doc,
              matches.map((match, i) =>
                Decoration.inline(match.from, match.to, {
                  class:
                    i === index
                      ? "rounded-[2px] bg-amber-400/70 text-inherit"
                      : "rounded-[2px] bg-amber-200/60 text-inherit",
                }),
              ),
            );
          },
        },
      }),
    ];
  },
});
