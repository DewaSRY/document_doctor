import {
  getPageImageUpstreamUrl,
  isValidPageNumber,
} from "@/feature/translator/media";
import { getAITranslationAuthorization } from "@/feature/translator/config";

/** Streams one rendered page of the original PDF from the AI service, for the
 *  editor's page backgrounds. */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/documents/[documentId]/pages/[page]">,
) {
  const { documentId, page } = await ctx.params;
  if (!isValidPageNumber(page)) {
    return new Response(null, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const upstream = await fetch(
    getPageImageUpstreamUrl(documentId, page, searchParams),
    {
      headers: getAITranslationAuthorization()
        ? { Authorization: getAITranslationAuthorization()! }
        : undefined,
      cache: "no-store",
    },
  ).catch(() => null);

  if (!upstream?.ok || !upstream.body) {
    return new Response(null, { status: upstream?.status === 404 ? 404 : 502 });
  }

  // The original upload never changes, so neither does its rendering.
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=86400, immutable",
    },
  });
}
