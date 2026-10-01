import type { MaskingActionResult } from "./types";

import { runServerAction } from "./action-result";
import { packResult } from "../masking-data/masking-server";

export async function runMaskingServerAction<T>(
  fn: () => Promise<T>,
): Promise<MaskingActionResult<T>> {
  return runServerAction(fn).then(packResult);
}
