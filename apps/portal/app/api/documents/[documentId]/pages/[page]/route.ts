import { AI_TRANSLATION_API_URL } from "@/feature/translator/config";

/** Streams one rendered page of the original PDF from the AI service, for the
 *  editor's page backgrounds. */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/documents/[documentId]/pages/[page]">,
) {
  const { documentId, page } = await ctx.params;
  if (!/^\d+$/.test(page)) {
    return new Response(null, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const params = new URLSearchParams();
  const scale = Number(searchParams.get("scale"));
  if (Number.isFinite(scale) && scale >= 0.5 && scale <= 4) {
    params.set("scale", String(scale));
  }
  if (searchParams.get("original") === "true") params.set("original", "true");

  const upstream = await fetch(
    `${AI_TRANSLATION_API_URL}/translated-document/${encodeURIComponent(documentId)}/pages/${page}/image?${params}`,
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
