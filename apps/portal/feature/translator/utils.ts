import { getServiceErrorMessage } from "@/components/file-tools/utils";

export const getTranslatorErrorMessage = getServiceErrorMessage;

export function getTranslatorErrorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}
