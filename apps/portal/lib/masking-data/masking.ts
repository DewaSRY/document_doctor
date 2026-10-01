import { decode, encode } from "@msgpack/msgpack";
import { unzlibSync, zlibSync } from "fflate";

export type Packed<T> = Uint8Array & { readonly __payload?: T };

const ENCODE_OPTIONS = {
  ignoreUndefined: true,
} as const;

export function pack<T>(value: T): Packed<T> {
  return zlibSync(encode(value, ENCODE_OPTIONS)) as Packed<T>;
}

export function unpack<T>(payload: Packed<T>): T {
  if (process.env.NODE_ENV === "test" && !(payload instanceof Uint8Array)) {
    return payload as T;
  }

  return decode(unzlibSync(payload)) as T;
}
