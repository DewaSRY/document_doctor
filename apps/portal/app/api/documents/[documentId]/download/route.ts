import { AI_TRANSLATION_API_URL } from "@/feature/translator/config";

/** Streams the translated file from the AI service, so the browser can
 *  download it with a plain link without reaching the service itself. */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/documents/[documentId]/download">,
) {
  const { documentId } = await ctx.params;

  const upstream = await fetch(
    `${AI_TRANSLATION_API_URL}/translated-document/${encodeURIComponent(documentId)}`,
    { cache: "no-store" },
  ).catch(() => null);

  if (!upstream?.ok || !upstream.body) {
    return new Response(null, { status: upstream?.status === 404 ? 404 : 502 });
  }

  const headers = new Headers({ "Cache-Control": "no-store" });
  for (const name of ["content-type", "content-disposition", "content-length"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new Response(upstream.body, { headers });
}
