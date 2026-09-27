import { AI_TRANSLATION_API_URL } from "@/feature/translator/config";

/** Streams an image of the original Word document from the AI service, for
 *  the editor's pages. */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/documents/[documentId]/media/[...path]">,
) {
  const { documentId, path } = await ctx.params;
  // Only images the document holds: word/media/<name>.
  if (path.length < 3 || path[0] !== "word" || path[1] !== "media" || path.some((part) => part === ".." || part === "")) {
    return new Response(null, { status: 404 });
  }

  const name = path.map(encodeURIComponent).join("/");
  const upstream = await fetch(
    `${AI_TRANSLATION_API_URL}/translated-document/${encodeURIComponent(documentId)}/media/${name}`,
  ).catch(() => null);

  if (!upstream?.ok || !upstream.body) {
    return new Response(null, { status: upstream?.status === 404 ? 404 : 502 });
  }

  // The original upload never changes, so neither do its images.
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "private, max-age=86400, immutable",
    },
  });
}
