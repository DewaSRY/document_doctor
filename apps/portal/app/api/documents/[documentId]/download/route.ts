import {
  AI_TRANSLATION_API_URL,
  getAITranslationAuthorization,
} from "@/feature/translator/config";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/documents/[documentId]/download">,
) {
  const { documentId } = await ctx.params;
  const authorization = getAITranslationAuthorization();
  const headers = new Headers();
  if (authorization) headers.set("Authorization", authorization);

  const clientIp = request.headers.get("cf-connecting-ip");
  if (clientIp) headers.set("X-Portal-Client-IP", clientIp);

  const upstream = await fetch(
    `${AI_TRANSLATION_API_URL}/translated-document/${encodeURIComponent(documentId)}`,
    { headers, cache: "no-store", signal: AbortSignal.timeout(2 * 60_000) },
  ).catch(() => null);

  if (!upstream?.ok || !upstream.body) {
    return new Response(null, {
      status: upstream?.status === 404 ? 404 : 502,
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  const responseHeaders = new Headers({
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "X-Content-Type-Options": "nosniff",
  });
  for (const name of ["content-type", "content-disposition"]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  return new Response(upstream.body, { headers: responseHeaders });
}