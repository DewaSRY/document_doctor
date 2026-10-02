import {
  getMediaUpstreamUrl,
  isAllowedMediaPath,
} from "@/feature/translator/media";
import { getAITranslationAuthorization } from "@/feature/translator/config";

/** Streams an image of the original Word document (word/media/…), or one
 *  added in the editor (upload/…), from the AI service, for the editor's pages. */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/documents/[documentId]/media/[...path]">,
) {
  const { documentId, path } = await ctx.params;
  if (!isAllowedMediaPath(path)) {
    return new Response(null, { status: 404 });
  }

  const upstream = await fetch(getMediaUpstreamUrl(documentId, path), {
    headers: getAITranslationAuthorization()
      ? { Authorization: getAITranslationAuthorization()! }
      : undefined,
    cache: "no-store",
  }).catch(() => null);

  if (!upstream?.ok || !upstream.body) {
    return new Response(null, { status: upstream?.status === 404 ? 404 : 502 });
  }

  // Neither the original upload nor an added image ever changes (a new image gets a new name).
  return new Response(upstream.body, {
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "private, max-age=86400, immutable",
    },
  });
}
