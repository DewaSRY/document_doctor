import "server-only";

/** Base URL of the AI translation service. Server-only: the browser never
 *  talks to the service directly (docs/TECH_DOC.md §5.1). */
export const AI_TRANSLATION_API_URL =
  process.env.AI_TRANSLATION_API_URL || "http://localhost:8080/api/v1";

export function getAITranslationAuthorization(): string | undefined {
  const token = process.env.AI_TRANSLATION_API_TOKEN;

  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXTJS_ENV !== "development" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    if (!token) {
      throw new Error("AI_TRANSLATION_API_TOKEN is required in production");
    }
    if (new URL(AI_TRANSLATION_API_URL).protocol !== "https:") {
      throw new Error("AI_TRANSLATION_API_URL must use HTTPS in production");
    }
  }

  return token ? `Bearer ${token}` : undefined;
}
