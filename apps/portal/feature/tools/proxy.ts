import "server-only";

import { AI_TRANSLATION_API_URL } from "@/feature/translator/config";
import { PROXIED_TOOL_ENDPOINTS, RESULT_HEADERS, isProxiedTool } from "./constants";

const FORWARDED_HEADERS = [
  "content-type",
  "content-disposition",
  "content-length",
  ...RESULT_HEADERS,
];

/** Forwards a tool's multipart upload to the AI service and streams its
 *  answer (a file, or JSON) back, so the browser never reaches the service
 *  itself and binary results do not have to pass through a Server Action. */
export async function proxyToolRequest(request: Request, tool: string): Promise<Response> {
  if (!isProxiedTool(tool)) {
    return Response.json({ message: "Unknown tool" }, { status: 404 });
  }

  const contentType = request.headers.get("content-type");
  if (!contentType?.startsWith("multipart/form-data") || !request.body) {
    return Response.json({ message: "Expected a file upload" }, { status: 415 });
  }

  const upstream = await fetch(`${AI_TRANSLATION_API_URL}${PROXIED_TOOL_ENDPOINTS[tool]}`, {
    method: "POST",
    headers: { "content-type": contentType },
    body: request.body,
    // Required by Node's fetch to stream a request body.
    duplex: "half",
    cache: "no-store",
    signal: AbortSignal.timeout(10 * 60_000),
  } as RequestInit).catch(() => null);

  if (!upstream) {
    return Response.json({ message: undefined }, { status: 502 });
  }

  // Server errors can carry internal details; the client shows its own text.
  if (upstream.status >= 500) {
    return Response.json({ message: undefined }, { status: upstream.status });
  }

  const headers = new Headers({ "Cache-Control": "no-store" });
  for (const name of FORWARDED_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new Response(upstream.body, { status: upstream.status, headers });
}
