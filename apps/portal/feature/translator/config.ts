import "server-only";

/** Base URL of the AI translation service. Server-only: the browser never
 *  talks to the service directly (docs/TECH_DOC.md §5.1). */
export const AI_TRANSLATION_API_URL =
  process.env.AI_TRANSLATION_API_URL || "http://localhost:8080/v1";
