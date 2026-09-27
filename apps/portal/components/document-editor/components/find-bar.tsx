"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { useTranslation } from "react-i18next";
import { CaseSensitive, ChevronDown, ChevronUp, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { getSearchState } from "./search-extension";

const inputClass =
  "h-7 min-w-0 flex-1 rounded-xs border border-border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

/** Find and replace across every segment, like Google Docs' (⌘F / ⌘⇧H). */
export function FindBar({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const { t } = useTranslation("editor");
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useEditorState({
    editor,
    selector: ({ editor }) => {
      const { matches, index } = getSearchState(editor.state);
      return { count: matches.length, index };
    },
  });

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    return () => {
      editor.commands.setSearchQuery("");
    };
  }, [editor]);

  function close() {
    onClose();
    editor.commands.focus();
  }

  const hasMatches = search.count > 0;

  return (
    <div
      role="search"
      className="absolute top-full right-3 z-40 mt-2 flex w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-1.5 rounded-lg border bg-popover p-2 text-popover-foreground shadow-lg"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        }
      }}
    >
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={query}
          placeholder={t("findPlaceholder")}
          aria-label={t("findPlaceholder")}
          className={inputClass}
          onChange={(event) => {
            setQuery(event.target.value);
            editor.commands.setSearchQuery(event.target.value, matchCase);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (event.shiftKey) editor.commands.findPrevious();
            else editor.commands.findNext();
          }}
        />
        <span aria-live="polite" className="w-16 shrink-0 text-center text-xs text-muted-foreground tabular-nums">
          {query
            ? hasMatches
              ? t("matchCount", { current: search.index + 1, count: search.count })
              : t("noMatches")
            : ""}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("matchCase")}
          title={t("matchCase")}
          aria-pressed={matchCase}
          className={matchCase ? "bg-muted text-foreground" : undefined}
          onClick={() => {
            setMatchCase(!matchCase);
            editor.commands.setSearchQuery(query, !matchCase);
            inputRef.current?.focus();
          }}
        >
          <CaseSensitive aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("previousMatch")}
          title={t("previousMatch")}
          disabled={!hasMatches}
          onClick={() => editor.commands.findPrevious()}
        >
          <ChevronUp aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("nextMatch")}
          title={t("nextMatch")}
          disabled={!hasMatches}
          onClick={() => editor.commands.findNext()}
        >
          <ChevronDown aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("closeFind")}
          title={t("closeFind")}
          onClick={close}
        >
          <X aria-hidden />
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <input
          value={replacement}
          placeholder={t("replacePlaceholder")}
          aria-label={t("replacePlaceholder")}
          className={inputClass}
          onChange={(event) => setReplacement(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            editor.commands.replaceMatch(replacement);
          }}
        />
        <Button
          variant="outline"
          size="xs"
          className="h-7"
          disabled={!hasMatches}
          onClick={() => editor.commands.replaceMatch(replacement)}
        >
          {t("replace")}
        </Button>
        <Button
          variant="outline"
          size="xs"
          className="h-7"
          disabled={!hasMatches}
          onClick={() => {
            editor.commands.replaceAllMatches(replacement);
            // The buttons are disabled once nothing matches; keep Escape working.
            inputRef.current?.focus();
          }}
        >
          {t("replaceAll")}
        </Button>
      </div>
    </div>
  );
}
