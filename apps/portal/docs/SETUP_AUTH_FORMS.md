# Auth Forms: React Hook Form + TanStack Query

How the login and register forms are built: client-side validation with
React Hook Form + Zod, submission with the TanStack Query mutations from
`SETUP_REACT_QUERY.md`, and a client-side session cookie write — replacing
the earlier `useActionState` + Server Action approach.

Files:

- [feature/auth/schemas.ts](../feature/auth/schemas.ts) — Zod schemas, built
  as functions of a translator so validation messages are localized.
- [components/form/input-field.tsx](../components/form/input-field.tsx),
  [components/form/type.ts](../components/form/type.ts) — the shared
  `InputField`, wrapping `Controller` + the `Field`/`Input` primitives from
  `components/ui/`. Already existed before this change; every form field in
  the app is built on top of it.
- [feature/auth/hooks/query.ts](../feature/auth/hooks/query.ts) —
  `useLoginMutation`/`useRegisterMutation`, unchanged in shape from
  `SETUP_REACT_QUERY.md`'s "Mutations: the auth feature" section.
- [feature/auth/session-client.ts](../feature/auth/session-client.ts) — the
  browser-side counterpart to `feature/auth/session.ts`'s
  `setSessionCookie`.
- [components/auth/login-form.tsx](../components/auth/login-form.tsx),
  [components/auth/register-form.tsx](../components/auth/register-form.tsx)
  — the two Client Components that wire all of the above together.

## Why this shape

The session cookie (`feature/auth/constants.ts`'s `SESSION_COOKIE_NAME`) is
deliberately **not** `httpOnly` — `ApiInterceptor` reads it via
`document.cookie` for every client-side API call (see
`SETUP_API_PROVIDER.md`). That decision only pays off if login/register can
also _write_ the cookie from the browser, which a Server Action can't do
without a full form post + redirect round-trip. So the forms moved fully
client-side:

```
LoginFormScreen / RegisterFormScreen (Client Component)
   │  useForm + zodResolver(createLoginSchema(t))
   ▼
React Hook Form
   │  handleSubmit → validated values only
   ▼
useLoginMutation() / useRegisterMutation()   (feature/auth/hooks/query.ts)
   │  POST /auth/login, /auth/register — unchanged authClient calls
   ▼
onSuccess: setClientSessionCookie(token, expiresIn)
   │  document.cookie write — same shape as session.ts's server-side cookie
   ▼
router.push("/dashboard")   (@/i18n/navigation's useRouter — locale-aware)
```

This is additive to the existing pieces, not a rebuild: `authClient`,
`useLoginMutation`/`useRegisterMutation`, `ApiInterceptor`, and
`proxy.ts`/`(protected)/layout.tsx`'s cookie-presence checks are all
untouched. Only the form layer and where the cookie gets written changed.

`logoutAction` (`feature/auth/actions.ts`) stays a Server Action — a logout
button has no validated input and no reason to avoid a full navigation, so
there was nothing to gain by moving it client-side. `feature/auth/session.ts`
now only exports `clearSessionCookie`; `setSessionCookie` moved to
`session-client.ts` since nothing server-side calls it anymore.

## Step 1: A Zod schema per form, parameterized on the translator

```ts
// feature/auth/schemas.ts
import { z } from "zod";

type Translate = (key: string) => string;

export function createLoginSchema(t: Translate) {
  return z.object({
    email: z.string().min(1, t("emailRequired")).email(t("emailInvalid")),
    password: z.string().min(1, t("passwordRequired")),
  });
}

export type LoginFormScreenValues = z.infer<
  ReturnType<typeof createLoginSchema>
>;
```

The schema is a function, not a module-level constant, because validation
messages come from `next-intl`'s `useTranslations("Auth")` — a hook, only
callable inside a component. `createRegisterSchema` follows the same shape
plus a `.refine()` cross-field check for `confirmPassword === password`,
attached to the `confirmPassword` path so the error renders under that
field specifically rather than as a form-wide message.

The `usernameRequired`/`emailRequired`/`emailInvalid`/`passwordRequired`/
`passwordMinLength`/`confirmPasswordRequired` keys are new additions to the
`Auth` namespace in `messages/en/auth.json` and `messages/id/auth.json` —
the original `useActionState` forms never needed them because validation
was just the HTML `required`/`minLength` attributes plus whatever the
backend rejected.

## Step 2: The form component

```tsx
// components/auth/login-form.tsx
"use client";

const form = useForm<LoginFormScreenValues>({
  resolver: zodResolver(useMemo(() => createLoginSchema(t), [t])),
  defaultValues: { email: "", password: "" },
});

const onSubmit = form.handleSubmit((values) => {
  loginMutation.mutate(values, {
    onSuccess: ({ data }) => {
      setClientSessionCookie(data.data.access_token, data.data.expires_in);
      router.push("/dashboard");
    },
    onError: (error) => {
      const fieldErrors = getApiFieldErrors(error);
      if (fieldErrors) {
        for (const [field, message] of Object.entries(fieldErrors)) {
          form.setError(field as keyof LoginFormScreenValues, { message });
        }
        return;
      }
      form.setError("root", {
        message: getApiErrorMessage(error, t("loginError")),
      });
    },
  });
});
```

`useMemo(() => createLoginSchema(t), [t])` rebuilds the schema only when
`t` changes (i.e. on locale switch), not on every render — `zodResolver`
otherwise gets a fresh schema instance each render, which is harmless
functionally but pointless churn.

`getApiFieldErrors`/`getApiErrorMessage` (`lib/api/error.ts`) are unchanged
from the Server Action version — they parse the same backend error shape.
The only thing that changed is _where_ they're called from and how the
result reaches the UI: `form.setError(field, { message })` per backend
field error, or `form.setError("root", { message })` for a non-field error,
both surfaced through React Hook Form's `formState.errors` instead of a
`useActionState` reducer's returned object.

Each field renders through the existing shared `InputField`:

```tsx
<InputField
  control={form.control}
  name="email"
  label={t("email")}
  autoComplete="email"
/>
```

`InputField` (`components/form/input-field.tsx`) wraps RHF's `Controller`
around the `Field`/`Input` primitives, so it already handles wiring
`invalid`/`error` state to `FieldError` — no per-field error JSX needed in
the form component itself, unlike the old manual
`{state.fieldErrors?.username && <p>...</p>}` blocks.

## Step 3: Register returns tokens directly

`registerAction` used to call `authClient.register()` then immediately
`authClient.login()` so a new user lands signed in, not back at the login
page — that was needed because the old `/auth/register` endpoint didn't
return credentials. It now does: `authClient.register()` resolves to the
same `AuthResponse` shape (`access_token`/`expires_in`/`token_type`) as
`authClient.login()`, so `RegisterFormScreen` only needs the one mutation:

```ts
const onSubmit = form.handleSubmit(async (values) => {
  try {
    await registerMutation.mutateAsync(
      {
        username: values.username,
        email: values.email,
        password: values.password,
        password_confirm: values.confirmPassword,
      },
      {
        onSuccess: ({ data }) => {
          setClientSessionCookie(data.data.access_token, data.data.expires_in);
          router.push("/dashboard");
        },
      },
    );
  } catch (error) {
    const fieldErrors = getApiFieldErrors(error);
    if (fieldErrors) {
      for (const [field, message] of Object.entries(fieldErrors)) {
        form.setError(field as keyof RegisterFormScreenValues, { message });
      }
      return;
    }
    form.setError("root", {
      message: getApiErrorMessage(error, t("registerError")),
    });
  }
});
```

A single `try`/`catch` is enough now: there's no second network call whose
failure would mean something different from the first, so there's no
"registration succeeded but the follow-up login failed" case to route to
`/login` for anymore. `RegisterFormScreen` still declares `useLoginMutation()` and
folds `loginMutation.isPending` into the button's combined `isPending` —
that mutation is never actually triggered by the current submit handler, a
leftover from the chained-login version worth cleaning up if you touch this
file again.

## Step 4: Writing the session cookie from the browser

```ts
// feature/auth/session-client.ts
export function setClientSessionCookie(token: string, maxAgeSeconds: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  document.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}
```

Same `path=/`, `SameSite=Lax`, and prod-only `Secure` as
`session.ts`'s `setSessionCookie` — the two are meant to produce an
identical cookie, just from the two different runtimes that can set it.
`proxy.ts` and `(protected)/layout.tsx` (see `SETUP_AUTH_ROUTE_GROUPS.md`)
don't care which side wrote the cookie, only that it's present.

## Adding another client-side form

1. Add a `create<Name>Schema(t)` function to the feature's `schemas.ts`
   (or create one if the feature doesn't have one yet), returning a Zod
   object schema and exporting `type <Name>FormValues = z.infer<...>`.
2. Add any new validation-message keys the schema needs to that feature's
   message namespace, in every locale under `messages/`.
3. Build the form with `useForm` + `zodResolver` + the shared `InputField`
   per field, driven by a `useMutation` hook from that feature's
   `hooks/query.ts` (see `SETUP_REACT_QUERY.md` if that feature doesn't
   have one yet).
4. Surface backend errors with `form.setError(field, {...})` for field-level
   errors (`getApiFieldErrors`) and `form.setError("root", {...})` for
   everything else (`getApiErrorMessage`) — don't invent a parallel error
   state, React Hook Form's `formState.errors` is already the single source
   of truth once the form is wired this way.

## Verification performed

- `yarn tsc --noEmit` — clean.
- `yarn lint` — clean (no new warnings; the pre-existing unused-import
  warnings in `app/[locale]/(public)/layout.tsx` and
  `components/locale-switcher.tsx` predate this change).
- `yarn build` — succeeds; `/[locale]/login` and `/[locale]/register`
  still compile as dynamic routes.
