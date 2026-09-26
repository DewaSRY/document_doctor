# Translated Zod Form Errors — As Implemented

## Who this doc is for

You should be comfortable with `react-hook-form`, Zod schemas, and this
app's `react-i18next` setup (`i18n/settings.ts`). You don't need prior
context on why `feature/account/form.ts` exists — that's what Section 1
covers.

This doc is verified against the source in this repo, not the intended
design — every real claim below cites a `file:line`.

## Section 1 — The problem this solves

A Zod schema's `.min(1, "message")` argument has to be a plain string,
decided at schema-*definition* time. Two ways to get a translated message
into it both have a cost:

| Approach | Cost |
| --- | --- |
| Call `t("key")` when building the schema, then rebuild the schema (`useMemo(() => schema(t), [t])`) whenever the locale changes | The schema object is recreated on every locale/`t` identity change, and the schema factory now has an i18n dependency baked into what should be pure validation logic |
| Put the raw i18n **key** in the schema (a schema that never changes) and translate the key *after* Zod produces `FieldErrors`, right before the resolver hands them to `react-hook-form` | The resolver has to walk the `FieldErrors` tree and rewrite `error.message` in place |

`feature/account/form.ts` implements the second approach: a static schema,
translated at resolve-time.

## Section 2 — API

All of the following live in `feature/account/form.ts`, and are schema/domain
agnostic despite the `feature/account` location — nothing in the file is
account-specific.

- **`zodResolverTranslate(schema, t)`** (`feature/account/form.ts:54`) — a
  drop-in replacement for `@hookform/resolvers/zod`'s `zodResolver`. Runs the
  normal Zod resolver, then calls `translateErrors` on the result before
  returning it.
- **`translateErrors(errors, t)`** (`feature/account/form.ts:32`) — walks a
  `FieldErrors` tree (recursing into nested fields, skipping RHF's internal
  `ref`/`refs`/`types` keys) and replaces each `error.message` in place by
  running it through `t`.
- **`parseTranslateMessage(message)`** (`feature/account/form.ts:9`, not
  exported) — splits a raw error message on `::` into a translation key and
  an optional param string (`k1:v1;k2:v2`), so a schema can encode
  interpolation params directly in the Zod message, e.g.
  `.min(6, "passwordTooShort::min:6")` → `t("passwordTooShort", { min: "6" })`.
- **`getFirstErrorFieldPath(errors)`** / **`scrollToFirstError(errors)`**
  (`feature/account/form.ts:71`, `:95`) — find the first field with an actual
  `{message, type}` error (as opposed to a parent object node) and scroll the
  DOM element with that `id` into view.
- **`scrollToViewById(id)`** (`feature/account/form.ts:104`) — generic
  scroll-into-view helper, not error-specific.

## Section 3 — Reference implementation

`components/navigation/create-account-dialog.tsx` is the one form in the
codebase wired up to this module; use it as the template for new forms.

1. **Schema stays static and locale-free** — `feature/account/schema.ts`
   exports `createAccountSchema` as a plain `z.object(...)`, not a factory.
   The `.min(1, ...)` messages are the raw keys `"nameRequired"` /
   `"descriptionRequired"`, not translated strings.
2. **Resolver translates at call time** —
   `create-account-dialog.tsx:38` calls
   `zodResolverTranslate(createAccountSchema, t)` instead of
   `zodResolver(schema)`. No `useMemo` needed since the schema no longer
   depends on `t`.
3. **Invalid submits scroll to the first error** —
   `create-account-dialog.tsx:45-70` passes a second argument to
   `form.handleSubmit(onValid, onInvalid)`; `onInvalid` calls
   `scrollToFirstError(errors)`.
4. **Fields need a DOM `id` matching their RHF field path** —
   `scrollToFirstError` looks up `document.getElementById(fieldPath)`, so
   `components/form/input-field.tsx:36` and
   `components/form/textarea-field.tsx:65` now set `id={name}` on the
   underlying `<Input>`/`<Textarea>` by default (overridable by the caller).
   Without this, `scrollToFirstError` silently finds nothing.

## Section 4 — Known gap: the `account` i18n namespace doesn't exist yet

`create-account-dialog.tsx` calls `useTranslation("account")`, but
`"account"` is not in the registered namespace list
(`i18n/settings.ts:10`, currently `["common", "auth", "transfer"]`), and
there is no `messages/en/account.json` or `messages/id/account.json` (only
`auth.json`, `common.json`, `transfer.json` exist under `messages/en` /
`messages/id`). This predates this change — it means every `t(...)` call in
this dialog (`createAccountTitle`, `nameRequired`, `registerError`, etc.)
currently falls back to returning the raw key as display text.

`zodResolverTranslate` will translate correctly the moment this is fixed;
it doesn't need any further code change. To fix it:

1. Add `"account"` to the `namespaces` tuple in `i18n/settings.ts:10`.
2. Create `messages/en/account.json` and `messages/id/account.json` with
   keys: `createAccountTitle`, `createAccountDescription`, `name`,
   `description`, `nameRequired`, `descriptionRequired`, `registerError`.
3. Confirm wherever namespaces are preloaded server-side (see
   `i18n/server.ts`) picks up the new namespace — check how `"transfer"` is
   wired there as a template, since it's the most recently added namespace.

## Section 5 — Adding this to a new form

1. Define the Zod schema as a static object/constant with raw i18n keys as
   the message arguments (see Section 3, step 1). If a message needs
   interpolation, encode it as `"key::param:value"`.
2. `useForm({ resolver: zodResolverTranslate(schema, t) })`.
3. Pass an `onInvalid` handler to `form.handleSubmit` that calls
   `scrollToFirstError(errors)`.
4. Use `InputField`/`TextareaField` (or any field component that sets
   `id={name}`) so the scroll target actually exists in the DOM.
5. Make sure the `t`'s namespace is registered per Section 4 — otherwise
   messages will render as raw keys, same as the current `account` gap.
