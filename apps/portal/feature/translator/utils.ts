/** Reads the service's `message` from a failed request, for errors whose
 *  text is useful to the user (unsupported file, file too large, …). */
export function getTranslatorErrorMessage(error: unknown): string | undefined {
  const data = (error as { response?: { data?: { message?: unknown } } })
    ?.response?.data;
  return typeof data?.message === "string" ? data.message : undefined;
}

export function getTranslatorErrorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}
