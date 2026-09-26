export {
  authQueryKeys,
  useLoginMutation,
  useRegisterMutation,
  useProfileQuery,
  useLogoutMutation,
} from "./hooks/query";
export {
  createLoginSchema,
  type LoginFormScreenValues,
  createRegisterSchema,
  type RegisterFormScreenValues,
} from "./schemas";
export { SessionGuard } from "./components/session-guard";

// `verifySession` (./dal) is intentionally NOT re-exported here: it's
// marked "server-only" (reads next/headers), and re-exporting it from this
// barrel would pull that server-only module into the graph of every client
// component that imports anything else from "@/feature/auth" (Next.js
// taints the whole barrel module, not just the used export) — breaking the
// client bundle. Its one consumer, the protected layout Server Component,
// imports it directly from "@/feature/auth/dal" instead.
