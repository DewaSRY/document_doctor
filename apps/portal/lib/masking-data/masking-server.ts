import "server-only";
import { pack, Packed } from "./masking";

// use it on server
export function packResult<T>(result: T): Packed<T> {
  return pack(result);
}
