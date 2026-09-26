# Handling Paginated List Data (Next.js + nuqs)

A pattern for building a paginated, filterable list page in Next.js (App Router) where
**the URL is the single source of truth** for page number, page size, and active filters.

## Why URL-driven pagination

- Page/filter state survives refresh, back/forward navigation, and is shareable as a link.
- List data is fetched **server-side** in a Server Component, not via a client-side
  `useEffect` fetch or client-only query cache. The client only owns the interactive
  widgets (inputs, pagination controls) and syncs their state into the URL; navigating to
  the new URL re-triggers the server fetch automatically.
- Avoids duplicating "current page" state in two places (a `useState` and the URL) that
  can drift out of sync.

## Architecture overview

```
Browser URL (?page=2&limit=50&keyword=foo)
        │  read on the server
        ▼
Server Component page (e.g. app/items/page.tsx)
  - parses searchParams into typed fetch params
  - fetches { data, meta } from the API
  - passes data + meta down as props
        │
        ▼
Client list component ("use client")
  - useQueryStates(...) mirrors the same URL params into local state
  - filter inputs / pagination controls read from that state and call setQuery(...)
  - setQuery updates the URL → Next.js re-runs the Server Component → new props flow in
```

Two layers read the _same_ query params: the server page (to fetch data) and the client
component (via `useQueryStates`, to keep controls in sync and trigger navigation). They
must agree on param names, or the URL and the fetched data will disagree.

## 1. Install and mount the nuqs adapter

```bash
npm install nuqs
```

Wrap the app once, near the root layout, with the Next.js App Router adapter:

```tsx
// app/layout.tsx
import { NuqsAdapter } from "nuqs/adapters/next/app";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
```

Do this once per app — not per page.

## 2. Define the shared pagination response shape

Standardize what a paginated API response looks like so every list feature can reuse it:

```ts
// types/pagination.ts
export interface Meta {
  page: number;
  size: number;
  total_item: number;
  total_page: number;
}

export interface MetaResponse<T> {
  data: T[];
  meta: Meta;
}

export const DEFAULT_META: Meta = {
  page: 1,
  size: 25,
  total_item: 0,
  total_page: 1,
};
```

## 3. Server page: parse `searchParams` and fetch

In the App Router, `searchParams` is passed to a page as a `Promise` of
`Record<string, string | string[] | undefined>` (values can be arrays because a query key
can repeat). Parse it into typed, defaulted fetch params before calling the API — never
pass raw `searchParams` straight into a request.

```ts
// lib/param-parser.ts
export function parseIntParam(
  value: string | string[] | undefined,
  defaultValue: number,
): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === "") return defaultValue;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

export function parseStringParam(value: string | string[] | undefined): string {
  if (value === undefined) return "";
  return Array.isArray(value) ? value.join(",") : value;
}

export function parseArrayParam(
  value: string | string[] | undefined,
  defaultValue: string[] = [],
): string[] {
  if (value === undefined) return defaultValue;
  if (Array.isArray(value)) return value.filter(Boolean);
  return value.split(",").filter(Boolean);
}
```

```ts
// features/item/params.ts
type SearchParams = Record<string, string | string[] | undefined>;

export interface ItemListFetchParams extends Record<string, string> {
  page: string;
  size: string;
  keyword: string;
  category_id: string;
}

export function parseItemListSearchParams(
  searchParams: SearchParams,
): ItemListFetchParams {
  return {
    page: String(parseIntParam(searchParams.page, 1)),
    size: String(parseIntParam(searchParams.limit, 25)),
    keyword: parseStringParam(searchParams.keyword),
    category_id: parseArrayParam(searchParams.category_id).join(","),
  };
}
```

```tsx
// app/items/page.tsx
interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ItemsPage({ searchParams }: Props) {
  const params = parseItemListSearchParams(await searchParams);

  let response: MetaResponse<Item> | null = null;
  let isError = false;
  try {
    response = await itemProvider.fetchItems(params);
  } catch (error) {
    isError = true;
    console.error("error fetching items", error);
  }

  return (
    <ListItemScreen
      items={response?.data ?? []}
      meta={response?.meta ?? DEFAULT_META}
      isError={isError}
    />
  );
}
```

Always fall back to `DEFAULT_META` and an empty array on error, and pass an `isError`
flag down, so the list UI can render an empty/error state instead of crashing.

> **Naming tip:** if the client-facing query param (e.g. `limit`) differs from the
> backend's param name (e.g. `size`), keep that mapping explicit in one place (the parser
> function above) rather than letting each layer guess the other's name.

## 4. Client component: mirror the same params with `useQueryStates`

In the `"use client"` list component, declare one `useQueryStates` call describing every
URL param the page cares about — page, page size, and each filter:

```tsx
"use client";
import { useTransition } from "react";
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  useQueryStates,
} from "nuqs";

export default function ListItemScreen({ items, meta, isError }: Props) {
  const [isPending, startTransition] = useTransition();
  const queryStateOptions = { shallow: false as const, startTransition };

  const [query, setQuery] = useQueryStates({
    page: parseAsInteger.withOptions(queryStateOptions).withDefault(1),
    limit: parseAsInteger.withOptions(queryStateOptions).withDefault(25),
    keyword: parseAsString.withOptions(queryStateOptions).withDefault(""),
    category_id: parseAsArrayOf(parseAsString)
      .withOptions(queryStateOptions)
      .withDefault([]),
  });

  // ...
}
```

Key rules to always apply:

- **`shallow: false`** forces a real Next.js navigation (not just a `history.pushState`),
  which is what makes the Server Component re-fetch with the new params. Without it, the
  URL changes but the rendered data does not.
- **`startTransition` from `useTransition()`** wraps the navigation in a transition so an
  `isPending` flag is available to drive a loading state while the new server data streams
  in.
- Chain **`.withOptions(queryStateOptions)`** onto every field individually — there is no
  single global option you can apply once for the whole `useQueryStates` call.
- Chain **`.withDefault(...)`** on every field so state values are never `null`/`undefined`,
  and so nuqs omits a param from the URL entirely when it equals its default (keeps the URL
  clean, e.g. `?page=1` is dropped rather than written).
- Pick the parser that matches the value: `parseAsInteger` for page/size,
  `parseAsString` for a single text/id filter, `parseAsArrayOf(parseAsString)` for a
  multi-select filter (serialized as comma-separated values in the URL).

### Updating state from a filter change

Always reset `page` back to `1` whenever a filter changes, so the user doesn't get stuck
on a page number that no longer has any matching rows:

```tsx
setQuery((prev) => {
  prev.category_id = selectedIds;
  prev.page = 1;
  return prev;
});
```

For plain pagination controls, a partial object is enough:

```tsx
onPageChange={(p) => setQuery({ page: p })}
onRowsPerPageChange={(l) => setQuery({ limit: l, page: 1 })}
```

## 5. Pagination controls component

Keep the pagination UI itself fully controlled (no internal page state) — it should just
render buttons/selects and call the callbacks it's given:

```tsx
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalRows: number;
  rowsPerPage?: number;
  rowsPerPageOptions?: number[];
  onRowsPerPageChange?: (rows: number) => void;
}
```

Drive `currentPage`/`rowsPerPage` from the **server-confirmed `meta`** (not the raw local
`query` state) when possible — that way the displayed page always reflects what the API
actually returned, avoiding a one-frame mismatch while a navigation is pending:

```tsx
<Pagination
  totalPages={meta.total_page || 0}
  currentPage={meta.page || 1}
  onPageChange={(p) =>
    setQuery((prev) => {
      prev.page = p;
      return prev;
    })
  }
  totalRows={meta.total_item || 0}
  rowsPerPage={meta.size || 25}
  rowsPerPageOptions={[25, 50, 100]}
  onRowsPerPageChange={(l) =>
    setQuery((prev) => {
      prev.limit = l;
      prev.page = 1;
      return prev;
    })
  }
/>
```

## 6. Debounced text filters

Text search inputs should keep local state for instant typing feedback, debounce the
actual URL/state update (e.g. 300ms), and flush immediately on `Enter`:

```tsx
function DebouncedSearchInput({
  initialValue,
  onChange,
}: {
  initialValue: string;
  onChange: (v: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const debouncedOnChange = useMemo(
    () => debounce((val: string) => onChangeRef.current(val), 300),
    [],
  );
  useEffect(() => () => debouncedOnChange.cancel(), [debouncedOnChange]);

  return (
    <input
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        debouncedOnChange(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          debouncedOnChange.cancel();
          onChange(e.currentTarget.value);
        }
      }}
    />
  );
}
```

Wire its `onChange` the same way as any other filter — update the relevant field in
`query` and reset `page` to `1`.

## Checklist for a new paginated list page

1. Define/reuse a shared `Meta` / `MetaResponse<T>` shape for API responses.
2. Add an API call that accepts page/size/filter params and returns `MetaResponse<T>`.
3. Write a `parse<Entity>ListSearchParams` function that turns raw `searchParams` into
   typed, defaulted fetch params using small parser helpers (`parseIntParam`,
   `parseStringParam`, `parseArrayParam`).
4. Write the Server Component page: parse `searchParams`, fetch inside a `try/catch`, pass
   `data` / `meta` / `isError` down as props — never fetch in the client component.
5. In the `"use client"` list component, declare one `useQueryStates` call with
   `shallow: false` + `startTransition` applied to every field, using the **same param
   names** the server parser reads.
6. Wire filter inputs and pagination controls to read from `query`/`meta` and call
   `setQuery`, resetting `page` to `1` on any filter change.
7. Use the `isPending` flag from the same `useTransition` to drive the list's loading
   state while the new URL's server data is in flight.
