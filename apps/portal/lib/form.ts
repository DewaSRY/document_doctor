import { zodResolver } from "@hookform/resolvers/zod";
import { FieldErrors, FieldValues, Resolver } from "react-hook-form";
import type { ZodType } from "zod";

const TRANSLATE_PARAMS_DELIMITER = "::";
const TRANSLATE_PARAM_PAIR_DELIMITER = ";";
const TRANSLATE_PARAM_KV_DELIMITER = ":";

function parseTranslateMessage(message: string): {
  key: string;
  params?: Record<string, unknown>;
} {
  const [key, paramsString] = message.split(TRANSLATE_PARAMS_DELIMITER);

  if (!paramsString) {
    return { key };
  }

  const params: Record<string, unknown> = {};
  paramsString.split(TRANSLATE_PARAM_PAIR_DELIMITER).forEach((pair) => {
    const [paramKey, value] = pair.split(TRANSLATE_PARAM_KV_DELIMITER);
    if (paramKey && value !== undefined) {
      params[paramKey] = value;
    }
  });

  return { key, params };
}

const NON_RECURSABLE_ERROR_KEYS = new Set(["ref", "refs", "types"]);

export function translateErrors(
  errors: FieldErrors,
  t: (key: string, params?: Record<string, unknown>) => string,
) {
  Object.entries(errors).forEach(([key, error]) => {
    if (
      !error ||
      typeof error !== "object" ||
      NON_RECURSABLE_ERROR_KEYS.has(key)
    )
      return;

    if ("message" in error && typeof error.message === "string") {
      const { key: messageKey, params } = parseTranslateMessage(error.message);

      error.message = t(messageKey, params);
    }

    translateErrors(error as FieldErrors, t);
  });
}

export function zodResolverTranslate<
  Input extends FieldValues,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors react-hook-form's Resolver generics.
  Context = any,
  Output = Input,
>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- zod's Def generic is irrelevant here.
  schema: ZodType<Output, any, Input>,
  t: (key: string, params?: Record<string, unknown>) => string,
): Resolver<Input, Context, Output> {
  return async (values, context, options) => {
    const result = await zodResolver(schema)(values, context, options);

    translateErrors(result.errors, t);

    return result;
  };
}

export function getFirstErrorFieldPath(
  errors: FieldErrors,
  parentPath = "",
): string | null {
  for (const key of Object.keys(errors)) {
    const value = (errors as Record<string, unknown>)[key];
    if (!value || typeof value !== "object") continue;

    const currentPath = parentPath ? `${parentPath}.${key}` : key;

    if ("message" in value && "type" in value) {
      return currentPath;
    }

    const nestedPath = getFirstErrorFieldPath(
      value as FieldErrors,
      currentPath,
    );
    if (nestedPath) return nestedPath;
  }

  return null;
}

export function scrollToFirstError(errors: FieldErrors) {
  const firstErrorFieldPath = getFirstErrorFieldPath(errors);
  if (!firstErrorFieldPath) return;

  document
    .getElementById(firstErrorFieldPath)
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function scrollToViewById(id: string) {
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}
