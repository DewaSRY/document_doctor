import { z } from "zod";

import { fileSchema, requiredFile } from "@/components/file-tools/schema";

import { ACCEPTED_EXTENSIONS, LANGUAGE_CODES, MAX_FILE_SIZE } from "./constants";

// Messages are keys of the "translator" namespace, translated by
// zodResolverTranslate (lib/form.ts).

export const translateFileSchema = fileSchema({
  extensions: ACCEPTED_EXTENSIONS,
  maxSize: MAX_FILE_SIZE,
  messages: { type: "upload.invalidType", tooLarge: "upload.tooLarge", empty: "upload.empty" },
});

export const translateSchema = z
  .object({
    file: requiredFile(translateFileSchema, "upload.required"),
    sourceLanguage: z.enum(LANGUAGE_CODES),
    targetLanguage: z.enum(LANGUAGE_CODES),
  })
  .refine(({ sourceLanguage, targetLanguage }) => sourceLanguage !== targetLanguage, {
    path: ["targetLanguage"],
    message: "languageStep.sameLanguage",
  });

export type TranslateValues = z.input<typeof translateSchema>;
export type TranslateOutput = z.output<typeof translateSchema>;
