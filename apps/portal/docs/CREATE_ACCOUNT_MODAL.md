# Create Account Modal — As Implemented

## Who this doc is for

You should be comfortable with React hooks, Zustand, TanStack Query
mutations, and React Hook Form + Zod — see `SETUP_REACT_QUERY.md` and
`FORM_ERROR_TRANSLATION.md` if any of those are new. You don't need prior
context on this app's "unsaved changes" guard; [the cross-feature coupling
section](#cross-feature-coupling) explains exactly what this feature borrows
from it and links to `SETUP_NAVIGATION_GUARD.md` for the full mechanism.

This doc is verified against the source in this repo (including the
uncommitted working-tree changes to `create-account-dialog.tsx` and
`preview-step.tsx` at the time of writing — see `git diff` for those two
files if you want the exact patch), not the idealized design. Every real
claim below cites a `file:line`.

## Section 0 — Background Primer: the multi-step modal Zustand store

This app has five multi-step/confirm modals living under `components/`:
`create-account-model`, `edit-account-model`, `delete-account-model`,
`deposite-model`, and `transfer-modal`. Each keeps its wizard state (current
step, in-progress values) in its own local Zustand store — never in
TanStack Query, which stays reserved for server state (see the root
`AGENTS.md`'s "Multi-step modal Zustand stores" row).

| Modal | Steps | Store shape |
| --- | --- | --- |
| `create-account-model` (this doc) | `form` → `preview` | `{ step, values, fieldErrors }` |
| `edit-account-model` | `form` → `preview` | Identical shape to create-account's, just renamed types (`edit-account-model/store.ts:1-46` vs `create-account-model/store.ts:1-46`) |
| `transfer-modal` | `source` → `destination` → `details` | `{ step, sourceAccount, destinationAccount, details }` — no `fieldErrors`, more fields because it has more steps |
| `delete-account-model` | none (single confirm dialog) | No store at all — `components/delete-account-model/delete-account-dialog.tsx` is the only file in that folder |

**Worth knowing before you build a sixth one:** `create-account-model/store.ts`
is a near-verbatim structural clone of `edit-account-model/store.ts` — same
four state fields, same four actions, same `reset()`-to-`initialState`
pattern, only the imported types differ. There is no shared "two-step
form/preview store" factory; each feature hand-rolls its own copy. If you
add a seventh two-step wizard, decide up front whether to keep copying this
shape or finally factor it out — see the naming/duplication callout in
[Rough edges](#rough-edges-worth-knowing-about).

## Section 1 — Architecture at a Glance

The composition root is `components/create-account-model/create-account-dialog.tsx`'s
`CreateAccountDialog` — it owns the RHF form instance, wires the navigation
guard, and switches between the two step components. It doesn't itself
validate anything or call the API; it delegates both to the pieces below.

The dialog is mounted from `components/navigation/app-sidebar.tsx:20,49` via
`CreateNewAccount`, always rendered inside the sidebar (not lazily) with its
own `open`/`setOpen` state living in `CreateNewAccount`, not the dialog
itself.

| Concern | Owner (file) | Analogy |
| --- | --- | --- |
| Sidebar trigger button + open/close boolean | `CreateNewAccount` (`components/create-account-model/create-new-account.tsx`) | The doorbell — the only thing that knows how to summon the dialog |
| Dialog shell, step switch, RHF form instance, navigation-guard wiring | `CreateAccountDialog` (`create-account-dialog.tsx`) | The receptionist — decides which room (step) you're shown and won't let you leave mid-conversation without confirming |
| Wizard step + in-flight form values + server-returned field errors | `useCreateAccountStore` (`store.ts`) | A sticky note the receptionist keeps between rooms — survives the step switch, cleared on `reset()` |
| Step 1: collect `name`/`description` via RHF-controlled fields | `FormStep` (`form-step.tsx`) | The intake form |
| Step 2: read-only recap + the actual `POST /accounts` call | `PreviewStep` (`preview-step.tsx`) | The "confirm before we file this" desk |
| Validation schema + form-value type | `feature/account/schema.ts`'s `createAccountSchema`/`CreateAccountFormValues` | The intake form's fine print |
| The typed HTTP call + query invalidation | `feature/account/hooks/query.ts`'s `useCreateAccountMutation` | The actual filing clerk |

It's split this way so the two steps never need to know about each other's
concerns: `FormStep` only validates and hands values to the store, and
`PreviewStep` only reads from the store and talks to the mutation. Neither
step owns navigation/close behavior — that stays entirely in
`CreateAccountDialog`, which is why adding the navigation guard (see below)
only required touching one file plus a one-line callback swap in
`PreviewStep`.

## Section 2 — `CreateNewAccount`: the trigger

**The problem this solves:** something has to own the dialog's open/closed
boolean and render the button that flips it.

**How it's implemented** — the entire component
(`create-new-account.tsx:8-23`):

```tsx
export function CreateNewAccount() {
  const { t } = useTranslation("account");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  return (
    <div>
      <CreateAccountDialog open={isDialogOpen} setOpen={setIsDialogOpen} />
      <IconButton
        text={t("createNewAccount")}
        icon={<Plus className="size-4" />}
        tooltip={t("createNewAccount")}
        onClick={() => setIsDialogOpen(true)}
        iconPosition="right"
      />
    </div>
  );
}
```

**Worth knowing:** `CreateAccountDialog` is always mounted here, not
conditionally rendered on `isDialogOpen` — Base UI's `Dialog.Root`
(`components/ui/dialog.tsx:11-13`) handles show/hide internally via its own
`open` prop, so the wizard's Zustand store and RHF form instance exist even
while the dialog is closed. That's why `CreateAccountDialog`'s own
`handleOpenChange` (Section 3) has to explicitly `reset()` the store on
every re-open — nothing unmounts it for you.

## Section 3 — `CreateAccountDialog`: the composition root

**The problem this solves:** something has to create one RHF form instance
that both steps share, decide which step's UI to render, and answer "is it
safe to close this dialog right now?"

**How the form instance is created** (`create-account-dialog.tsx:24-32`):

```tsx
export function useCreateAccountForm(t: (key: string) => string) {
  return useForm({
    resolver: zodResolverTranslate(createAccountSchema, t),
    defaultValues: {
      name: "",
      description: "",
    },
  });
}

export type CreateForm = ReturnType<typeof useCreateAccountForm>;
```

`zodResolverTranslate` (`lib/form.ts:54-69`) wraps the plain `zodResolver`
so a Zod error message like `"nameRequired"` gets run through `t()` before
RHF ever sees it — see `FORM_ERROR_TRANSLATION.md` for the full mechanism.
This is the **static schema + `zodResolverTranslate`** pattern the root
`AGENTS.md` recommends for new forms, not the older schema-factory-plus-`useMemo`
pattern `feature/auth/schemas.ts` still uses.

**If you're new to this codebase's form conventions:** the exported
`CreateForm` type (`create-account-dialog.tsx:34`) exists purely so
`FormStep` and `PreviewStep` can type their `form` prop without importing
`useForm`'s generic signature themselves — both step components import it
as `import type { CreateForm } from "./create-account-dialog"`
(`form-step.tsx:12`, `preview-step.tsx:12`).

**How the step switch works** (`create-account-dialog.tsx:59-97`):

```tsx
const STEP_COPY = {
  form: { title: t("createAccountTitle"), description: t("createAccountDescription") },
  preview: { title: t("reviewAccountTitle"), description: t("reviewAccountDescription") },
} as const;

const { title, description } = STEP_COPY[step];
```

`step` comes from `useCreateAccountStore()`, not local component state —
this is what lets `FormStep`'s submit handler drive the dialog's header copy
by simply calling `setStep("preview")` (Section 5) without `CreateAccountDialog`
needing any callback prop for it.

### The navigation guard wiring

**The problem this solves:** a user who has typed a name/description and
then clicks outside the dialog (or presses browser back) would otherwise
lose that input silently — the same problem `SETUP_NAVIGATION_GUARD.md`
solves for full-page forms, applied here to a modal for the first time.

**How it's implemented** (`create-account-dialog.tsx:47-57`):

```tsx
const isDirty = form.formState.isDirty;
const setGuard = useNavigationGuardStore((s) => s.setGuard);
const requestNavigation = useNavigationGuardStore((s) => s.requestNavigation);

useEffect(() => {
  if (!open) return;
  setGuard(isDirty, {
    onAbort: () => {
      form.reset();
      reset();
    },
  });
  return () => setGuard(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [open, isDirty, setGuard, form]);
```

This follows `SETUP_NAVIGATION_GUARD.md` Section 6's documented "wiring a
screen" recipe almost exactly (`if (!open) return` is the only addition,
needed because this store/effect exist even while the dialog is closed —
see Section 2), with one difference worth flagging: `onAbort` here resets
**both** the RHF form and the wizard's own Zustand store, where
`RegisterFormScreen`'s `onAbort` only resets its form (it doesn't need a
second store — it isn't a multi-step wizard).

Closing the dialog is then routed through the guard instead of closing
directly (`create-account-dialog.tsx:72-79`):

```tsx
function handleOpenChange(nextOpen: boolean) {
  if (nextOpen) {
    setOpen?.(true);
    reset();
    return;
  }
  requestNavigation(() => setOpen?.(false));
}
```

| `nextOpen` | What happens |
| --- | --- |
| `true` (dialog opening) | Opens immediately and unconditionally calls the store's `reset()` — see the rough edge below for why this is safe. |
| `false` (dialog closing — outside click, close button, Escape) | Never closes directly. Defers to `requestNavigation`: if the form isn't dirty, closes immediately; if it is, the shared "unsaved changes" dialog opens instead (same one used app-wide, per `SETUP_NAVIGATION_GUARD.md` Section 4). |

A successful submission uses a **third**, separate close path that
bypasses the guard rather than tripping it on the way out
(`create-account-dialog.tsx:81-84`, called from `PreviewStep`):

```tsx
function handleSuccessClose() {
  setGuard(false);
  setOpen?.(false);
}
```

**Worth knowing — the ordering here matters.** `setGuard(false)` runs
synchronously before `setOpen?.(false)`, mirroring the exact reasoning
`SETUP_NAVIGATION_GUARD.md` Section 6 documents for `RegisterFormScreen`'s
own success path: disarming the guard by waiting for the `isDirty` effect
to re-run isn't guaranteed to happen before the dialog closes, so it's
disarmed explicitly and synchronously instead.

## Section 4 — `useCreateAccountStore`: the wizard's memory

**The problem this solves:** `FormStep` and `PreviewStep` are siblings, not
parent/child — something outside RHF has to hold the validated values
between "submit step 1" and "actually call the API in step 2," plus ferry
server-side field errors back to step 1 if the API rejects them.

**How it's implemented** — the entire store (`store.ts:1-46`):

```ts
type State = {
  step: CreateAccountStep;
  values: CreateAccountFormValues | null;
  fieldErrors: Record<string, string> | null;

  setStep: (step: CreateAccountStep) => void;
  setValues: (values: CreateAccountFormValues) => void;
  setFieldErrors: (fieldErrors: Record<string, string> | null) => void;
  reset: () => void;
};
```

| Field | What it actually holds |
| --- | --- |
| `step` | `"form"` or `"preview"` (`type.ts:3`) — drives `CreateAccountDialog`'s header copy and which step component renders. |
| `values` | The RHF-validated `{ name, description }` from step 1, or `null` before the first successful submit. `PreviewStep` bails out with `if (!values) return null` (`preview-step.tsx:46`) if this is somehow still `null` when it renders. |
| `fieldErrors` | Set only when the backend rejects the create call with per-field validation errors (Section 6); consumed exactly once by an effect in `FormStep` (Section 5), then cleared. |

`type.ts` is worth a direct look — it's three lines, and two of them are a
re-export:

```ts
// type.ts:1-5
import type { CreateAccountFormValues } from "@/feature/account/schema";
export type CreateAccountStep = "form" | "preview";
export type { CreateAccountFormValues };
```

The wizard has exactly one type of its own (`CreateAccountStep`); its form
values type is just borrowed from `feature/account/schema.ts`, re-exported
so the rest of `create-account-model/*` can import it from a local path
instead of reaching into `feature/account` directly.

## Section 5 — `FormStep`: collecting input

**The problem this solves:** render the two fields, validate them, and hand
off to the preview step — while also being the landing spot if the preview
step comes back with a server-side rejection.

**How submission works** (`form-step.tsx:34-40`):

```tsx
const onSubmit = form.handleSubmit(
  (data) => {
    setValues(data);
    setStep("preview");
  },
  (errors) => scrollToFirstError(errors),
);
```

On valid input, this just writes to the store and advances the step — no
API call happens here at all; that's entirely `PreviewStep`'s job. On
invalid input, `scrollToFirstError` (`lib/form.ts`) scrolls to the first
field with an error, relying on `InputField`/`TextareaField` setting
`id={name}` on each control (per the root `AGENTS.md`'s note on those
components).

**How server-side field errors flow back in** (`form-step.tsx:24-32`):

```tsx
useEffect(() => {
  if (!fieldErrors) return;

  for (const [field, message] of Object.entries(fieldErrors)) {
    form.setError(field as keyof CreateAccountFormValues, { message });
  }
  setFieldErrors(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [fieldErrors]);
```

This is the landing side of the round-trip described in Section 6:
`PreviewStep` sends the user back to `"form"` and populates `fieldErrors`
in the same store `FormStep` reads from; this effect fires once,
applies each error via RHF's `setError`, then immediately clears
`fieldErrors` back to `null` so it can't reapply on a later unrelated
re-render.

**Rough edge:** `form.reset` isn't called anywhere in this round-trip — the
user's originally-typed `name`/`description` values are still sitting in
the RHF form (good: they don't have to retype anything), but the Zustand
store's `values` field is now stale (still holding the rejected values)
until the user resubmits step 1. Nothing currently reads `values` while on
the `"form"` step, so this is harmless today, but it means `values` isn't a
reliable "current form state" snapshot outside of the moment `PreviewStep`
reads it.

## Section 6 — `PreviewStep`: the actual API call

**The problem this solves:** show the user what they're about to create,
and only then make the real `POST /accounts` request.

**How it's implemented** (`preview-step.tsx:19-46`):

```tsx
const { values, setStep, setFieldErrors, reset } = useCreateAccountStore();
const { mutateAsync, isPending } = useCreateAccountMutation();
const [error, setError] = useState<string | null>(null);

async function handleConfirm() {
  if (!values) return;

  setError(null);
  try {
    await mutateAsync(values);
    onSuccess();
    form.reset();
    reset();
  } catch (err) {
    const fieldErrors = getApiFieldErrors(err);
    if (fieldErrors) {
      setFieldErrors(fieldErrors);
      setStep("form");
      return;
    }
    setError(getApiErrorMessage(err, t("registerError")));
  }
}
```

| Outcome of `mutateAsync(values)` | What happens |
| --- | --- |
| Success | `onSuccess()` (= `CreateAccountDialog`'s `handleSuccessClose`, Section 3) closes the dialog and disarms the guard; then the RHF form and the Zustand store are both reset, in that order. |
| Rejected with field-level details (`ApiErrorResponse.error.details`) | `getApiFieldErrors` (`lib/api/error.ts:15-31`) extracts them, they're stashed in the store, and the wizard is sent back to `"form"` — see Section 5 for the landing side. |
| Rejected with no field details (network error, generic 4xx/5xx) | A local `error` string is set and rendered inline (`preview-step.tsx:57`); the wizard stays on `"preview"` so the user can just retry `handleConfirm` without re-entering anything. |

**Rough edge — the fallback error copy's i18n key.** The generic-failure
fallback is `t("registerError")` (`preview-step.tsx:42`), and
`messages/en/account.json` does define `"registerError": "Unable to create
this account. Please try again."` — the message itself is correct for this
flow. But the *key name* is a leftover from the auth register flow's
naming, not this feature's — every sibling error key in the same file
(`updateError`, `deleteError`) is named after the action it belongs to
except this one. Grep before reusing or renaming it; it's live in exactly
this one call site.

**The mutation itself** is `useCreateAccountMutation`
(`feature/account/hooks/query.ts:35-50`):

```ts
export const useCreateAccountMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<CommonSuccessResponse<AccountResponse>, Error, RequestAccountbody>({
    mutationFn: (body) =>
      accountClient.createAccount(body).then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.all });
    },
  });
};
```

On success it invalidates every query under `queryKeys.all` (`["accounts"]`)
— both the dashboard's account list and the sidebar's `NavAccountList`
prefetch key share that root, so both pick up the new account without
either one being told about this mutation directly.

## Cross-feature coupling

- **First modal to use the navigation guard.** `SETUP_NAVIGATION_GUARD.md`'s
  cross-feature-coupling section currently states `RegisterFormScreen` is
  "the only current caller" of `setGuard`, and calls out that "two
  simultaneously-dirty guarded screens aren't supported by this store
  shape" as a sharp edge. `CreateAccountDialog` is now a second caller
  (confirmed via `git diff`, Section 3) — the sharp edge is no longer
  theoretical, though it isn't a live bug yet since a register-form
  navigation and this modal being open+dirty at the same time isn't a
  realistic user path today (the register form only exists on a logged-out
  route; this dialog only renders once a session exists). Worth updating
  that doc's caller count in the same change that introduced this wiring.
- **Shares `feature/account`'s query-key root with every other reader of
  account data.** `useCreateAccountMutation`'s `onSuccess` invalidates
  `queryKeys.all` (`["accounts"]`), the same root `useAccounts` and
  `useSearchAccountByNumber` build their keys from (`feature/account/hooks/query.ts:17-23`)
  — this dialog has no awareness of, or dependency on, who else is reading
  that data; TanStack Query's cache is the only coupling point.
- **Depends on `components/common/navigation-guard`'s global store and
  provider**, which must be mounted once near the app root
  (`app/[locale]/layout.tsx`, per `SETUP_NAVIGATION_GUARD.md` Section 1) for
  the guard dialog to render at all — this feature doesn't render its own
  confirm dialog for the "discard changes?" case, it relies entirely on the
  one shared instance.

## Component/presentational layer

`PreviewStep`'s recap card is built from `components/common/preview-row.tsx`'s
`PreviewRow` (label/value pairs, `preview-step.tsx:52-53`) inside a plain
`Card`/`CardContent` (`components/ui/card.tsx`) — no logic of its own. Both
step components lean on shared primitives rather than owning any styling
decisions: `InputField`/`TextareaField` (`components/form/`) for the two
fields, and `Dialog`/`DialogContent`/`DialogHeader`/`DialogFooter`/`DialogClose`
(`components/ui/dialog.tsx`) for the shell, footer, and cancel button — the
same primitives `NavigationGuardProvider`'s own confirm dialog and
`DeleteAccountDialog` are built from (`SETUP_NAVIGATION_GUARD.md`'s
component/presentational-layer section).

Note that `edit-account-model` has its own near-identical `form-step.tsx`
and `preview-step.tsx` — don't confuse the two folders when searching; they
are separate components with separate stores (Section 0), not the same
component reused for both create and edit.

## Summary / data flow

**Happy path:**

```
Sidebar "Create new account" click (CreateNewAccount)
   │
   ▼
CreateAccountDialog opens → handleOpenChange(true) → store.reset()
   │  step: "form"
   ▼
FormStep: user fills name/description → RHF validates via createAccountSchema
   │  onSubmit(data) → store.setValues(data); store.setStep("preview")
   ▼
PreviewStep renders values read-only → user clicks Confirm
   │  handleConfirm() → useCreateAccountMutation.mutateAsync(values)
   ▼
POST /accounts succeeds
   │  queryClient.invalidateQueries(["accounts"]) — dashboard/sidebar lists refetch
   ▼
onSuccess() = handleSuccessClose(): setGuard(false), setOpen(false)
   │
   ▼
form.reset(); store.reset()  — dialog is now closed and pristine for next open
```

**Discard-with-unsaved-changes path:**

```
User has typed into FormStep (form.formState.isDirty === true)
   │
   ▼
Effect in CreateAccountDialog: setGuard(true, { onAbort: form.reset + store.reset })
   │
   ▼
User clicks outside the dialog / presses Escape
   │
   ▼
handleOpenChange(false) → requestNavigation(() => setOpen(false))
   │  isGuarded === true → deferred, not run yet
   ▼
Shared NavigationGuardProvider dialog opens (SETUP_NAVIGATION_GUARD.md §4)
   │
   ├─ Cancel → dialog stays open, nothing changes
   │
   └─ Leave  → confirmLeave(): onAbort() runs (form+store reset), then
               the deferred setOpen(false) finally runs
```

**Server-side validation-error path:**

```
PreviewStep.handleConfirm() → mutateAsync(values) rejects with field details
   │
   ▼
getApiFieldErrors(err) → store.setFieldErrors({...}); store.setStep("form")
   │
   ▼
FormStep's effect: for each field, form.setError(field, {message})
   │  store.setFieldErrors(null) — consumed exactly once
   ▼
User sees their original input, now annotated with the server's error messages
```

## Final reference: API surface touched

| Method | Endpoint | Purpose | Called from |
| --- | --- | --- | --- |
| `POST` | `/accounts` | Create a new account for the current user | `AccountClient.createAccount` (`feature/account/client.ts:19-24`), via `useCreateAccountMutation` (`feature/account/hooks/query.ts:35-50`), triggered by `PreviewStep.handleConfirm` |

No other endpoint is touched by this feature — `feature/account/client.ts`'s
other two methods (`listMeAccounts`, `searchAccountByNumber`) are used
elsewhere (dashboard list, transfer's destination search) but not by any
file under `components/create-account-model/`.

## Rough edges worth knowing about

- **Reopening the dialog always calls `store.reset()`, but only the
  wizard's own store — not the RHF form.** (`create-account-dialog.tsx:73-76`).
  This is safe only because every path that closes the dialog while dirty
  goes through the guard's `onAbort`, which resets the RHF form itself
  first (Section 3) — there's no code path today where the dialog can reopen
  with a still-dirty leftover RHF form. If a future change adds a way to
  close the dialog that skips `requestNavigation`, this invariant breaks
  silently (the wizard step/values reset, but stale field values reappear).
- **`create-account-model/store.ts` is a structural duplicate of
  `edit-account-model/store.ts`** (Section 0) — there's no shared factory
  for the "two-step form/preview wizard" shape, so a bug fixed in one won't
  automatically apply to the other.
- **The generic-error fallback i18n key (`registerError`) is misnamed for
  this feature** (Section 6) — the string is correct, the key name isn't.
- **`SETUP_NAVIGATION_GUARD.md`'s claim that `RegisterFormScreen` is the
  only caller of `setGuard` is now stale** (Cross-feature coupling) — this
  dialog is a second, undocumented-until-now caller.
- **Folder naming**: this directory, like its siblings (`deposite-model`,
  `edit-account-model`, `delete-account-model`), uses "model" where "modal"
  is meant. Not tracked in `docs/IMPROVEMENT_OPPORTUNITIES.md` today, and
  the root `AGENTS.md`'s own directory listing uses the same spelling, so
  it reads as an established (if unintentional) convention rather than a
  one-off typo — grep for `create-account-model`/`-model` before assuming a
  rename is safe, the same caution the root `AGENTS.md` gives for
  `AccountTranscationClient`/`RequestAccountbody`.
