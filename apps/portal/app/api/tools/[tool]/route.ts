import { proxyToolRequest } from "@/feature/tools/proxy";

/** Forwards a tool's multipart upload to the AI service and streams its
 *  answer (a file, or JSON) back, so the browser never reaches the service
 *  itself and binary results do not have to pass through a Server Action. */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/tools/[tool]">,
) {
  const { tool } = await ctx.params;
  return proxyToolRequest(request, tool);
}
