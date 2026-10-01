import type { ActionErrorPayload, MaskingActionResult } from "./types";

import { unwrapActionResult } from "./action-result";
import { unpack } from "@/lib/masking-data/masking";

export function unpackActionResult<T>(result: MaskingActionResult<T>): T {
  return unwrapActionResult(unpack(result));
}
