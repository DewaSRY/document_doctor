import { AI_TRANSLATION_API_URL } from "@/feature/translator/config";

/** Streams an image of the original Word document (word/media/…), or one
 *  added in the editor (upload/…), from the AI service, for the editor's pages. */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/documents/[documentId]/media/[...path]">,
) {
  const { documentId, path } = await ctx.params;
  // Only images the document holds (word/media/<name>) or was given (upload/<name>).
  const original = path.length >= 3 && path[0] === "word" && path[1] === "media";
  const uploaded = path.length === 2 && path[0] === "upload" && /^[0-9a-f]{32}\.(png|jpeg|gif)$/.test(path[1]);
  if ((!original && !uploaded) || path.some((part) => part === ".." || part === "")) {
    return new Response(null, { status: 404 });
  }

  const name = path.map(encodeURIComponent).join("/");
  const upstream = await fetch(
    `${AI_TRANSLATION_API_URL}/translated-document/${encodeURIComponent(documentId)}/media/${name}`,
  ).catch(() => null);

  if (!upstream?.ok || !upstream.body) {
    return new Response(null, { status: upstream?.status === 404 ? 404 : 502 });
  }

  // Neither the original upload nor an added image ever changes (a new image gets a new name).
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "private, max-age=86400, immutable",
    },
  });
}
