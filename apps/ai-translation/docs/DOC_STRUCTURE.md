# Technical Documentation Template

_(Extracted from the "Notification System — As Implemented" doc)_

This template captures the **structure**, not the content. Feed it to an AI along with
your codebase and say: "follow this exact structure and style for [system name]."

---

## Core Stylistic Principles (state these explicitly to the AI)

1. **"As implemented", not "as designed."** The doc describes what the code
   actually does, verified line-by-line against source — not the idealized/intended
   behavior. Gaps between the two are called out explicitly, not smoothed over.
2. **Cite file:line for every real claim.** e.g. `(use-notification-stream.ts:58)`.
   This is what makes the doc trustworthy and grep-able.
3. **Name the rough edges on purpose.** Missing features, typos in the source,
   dead code, silent failure paths — call these out as their own callouts, not
   footnotes. Phrases like "worth flagging," "this trips people up," "a sharp
   edge to know about" signal the reader to slow down.
4. **Use tables for anything enumerable**: responsibilities, state fields, event
   names, endpoints, comparisons. Prose for anything sequential/causal.
5. **Prefer real code snippets over paraphrase** when the exact logic matters
   (error handlers, effect dependency arrays, parsing logic).

---

## Section-by-Section Skeleton

### Title

`<System Name> — As Implemented`

### "Who this doc is for"

- State the assumed background (e.g. "comfortable with React hooks, haven't
  necessarily used SSE").
- Point to the primer section if one exists, and say it's skippable for experts.
- One line setting expectations: this is verified-against-source, not aspirational —
  read closely before building on top of it, because some assumed behavior
  (autoretry, refresh, etc.) may not actually exist.

### Section 0 — Background Primer _(optional, only if the core tech is unfamiliar)_

- A comparison table of the chosen approach vs. its siblings (e.g. SSE vs
  Polling vs WebSocket) — columns: Approach / Direction / Transport / Typical use.
- Plain explanation of the core API/protocol being used.
- **Explicit "gotchas that surprise newcomers"** — 1-3 numbered behaviors that
  aren't obvious from the API surface, ideally connected forward to where the
  codebase deals with them ("this is why Section 2 exists").

### Section 1 — Architecture at a Glance

- Name the **composition root** (the top-level file/component that wires
  everything together) and confirm it doesn't itself implement the core logic
  — it delegates.
- A table: **Concern | Owner (file/hook/module) | Analogy**.
  The analogy column matters — it's what makes the table scannable.
- One paragraph on _why_ it's split this way (testability, separation of
  concerns) — and plant a forward-reference to a consequence of that split
  the reader will notice later.

### Sections 2–N — One Section Per Component/Hook/Module

Each of these follows the same internal shape:

1. **The problem this piece solves**, in plain language, before any code.
2. **How it's actually implemented**, step-by-step, with file:line citations
   and short real code snippets — not the whole file, just the load-bearing part.
3. **A sub-table if the piece has an enumerable set of things** (named events,
   state fields, config options) — columns like _Name | What actually happens_.
4. **A dedicated callout for divergence from expectation** — e.g. "Deliberately
   Not Auto-Reconnecting" — explaining the reasoning _in the code's own terms_
   (quote the comment if there is one), then stating the actual end-to-end
   consequence today.
5. **Explicit "if you're new to X, here's what's non-obvious" asides** for any
   library/pattern used (e.g. explaining `safeParse` vs `parse` for Zod).
6. **Rough edges, called out as their own bullets**, e.g. "no try/catch here,"
   "this function's `| null` return type suggests X but never actually returns
   null," a typo preserved in a schema name so it's greppable.

### A Section on Cross-Feature Coupling

- Anything **outside** this feature that reaches in and affects its lifecycle
  (auth logout closing a connection, another feature's error state tearing
  something down). Flag these explicitly as "surprising" / "worth knowing before
  you refactor the other thing."

### A Component/Presentational Layer Section

- Quick, low-detail pass over UI-only pieces with no logic — just enough so the
  reader knows where UI concerns live vs. where the real logic lives.
- Note any adjacent hook/component that exists but isn't part of this flow, so
  it doesn't get confused for part of the system.

### Summary / Data Flow Section

- One diagram or walkthrough per major flow (setup, happy path, error path),
  tying earlier sections together into a single sequence.

### Final Reference Table

- Every endpoint/API surface touched, in one table:
  **Method | Endpoint | Purpose**. Note ones that exist but are currently unused.

---

## Prompt You Can Give an AI

> "Write documentation for `<system>` following this exact structure: start with
> a 'who this is for' framing that says the doc is verified against source, not
> idealized. If there's an unfamiliar core technology involved, add a Section 0
> primer with a comparison table against alternatives and 1-3 non-obvious
> gotchas. Then an 'architecture at a glance' section naming the composition
> root and a Concern/Owner/Analogy table. Then one section per
> component/hook/module: problem it solves, step-by-step implementation with
> file:line citations and real code snippets, an enumerable-things table where
> relevant, and an explicit callout for any place the code's actual behavior
> diverges from what you'd expect (missing reconnect logic, silent failure
> paths, dead code, typos preserved in identifiers). Add a cross-feature
> coupling section for anything external that affects this system's lifecycle.
> Add a lightweight presentational-components pass. End with a data-flow
> summary and a full endpoint/API reference table."
