import { z } from "zod";

import { fileSchema, requiredFile } from "@/components/file-tools/schema";
import { LANGUAGE_CODES } from "@/feature/translator/constants";

import {
  DOCUMENT_AI_MAX_SIZE,
  DOCUMENT_EXTENSIONS,
  FILE_TOOL_MAX_SIZE,
  FIT_MODES,
  IMAGE_EXTENSIONS,
  IMAGE_FORMATS,
  IMAGE_MAX_SIZE,
  MAX_IMAGE_DIMENSION,
  MAX_MERGE_FILES,
  PDF_EXTENSIONS,
  SPLIT_MODES,
  SUMMARY_LENGTHS,
} from "./constants";

// Messages are keys of the "tools" namespace, translated by zodResolverTranslate
// (lib/form.ts); params follow "key::name:value".

const SIZE_MESSAGES = { tooLarge: "common.tooLarge", empty: "common.empty" };
const FILE_REQUIRED = "common.fileRequired";

export const documentFileSchema = fileSchema({
  extensions: DOCUMENT_EXTENSIONS,
  maxSize: FILE_TOOL_MAX_SIZE,
  messages: { ...SIZE_MESSAGES, type: "common.documentType" },
});

export const aiDocumentFileSchema = fileSchema({
  extensions: DOCUMENT_EXTENSIONS,
  maxSize: DOCUMENT_AI_MAX_SIZE,
  messages: { ...SIZE_MESSAGES, type: "common.documentType" },
});

export const pdfFileSchema = fileSchema({
  extensions: PDF_EXTENSIONS,
  maxSize: FILE_TOOL_MAX_SIZE,
  messages: { ...SIZE_MESSAGES, type: "common.pdfType" },
});

export const imageFileSchema = fileSchema({
  extensions: IMAGE_EXTENSIONS,
  maxSize: IMAGE_MAX_SIZE,
  messages: { ...SIZE_MESSAGES, type: "common.imageType" },
});

export const SAME_LANGUAGE = "same";
export const KEEP_FORMAT = "original";

export function isDimension(value: string): boolean {
  const number = Number(value);
  return (
    value.trim() !== "" &&
    Number.isInteger(number) &&
    number >= 1 &&
    number <= MAX_IMAGE_DIMENSION
  );
}

/** Empty means "keep the original" (null); otherwise a size in pixels. */
function toDimension(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

const outputFormat = z
  .enum([KEEP_FORMAT, ...IMAGE_FORMATS])
  .transform((format) => (format === KEEP_FORMAT ? null : format));

export const converterSchema = z.object({
  file: requiredFile(documentFileSchema, FILE_REQUIRED),
});

export const extractorSchema = z.object({
  file: requiredFile(aiDocumentFileSchema, FILE_REQUIRED),
});

export const summarizerSchema = z.object({
  file: requiredFile(aiDocumentFileSchema, FILE_REQUIRED),
  length: z.enum(SUMMARY_LENGTHS),
  language: z
    .enum([SAME_LANGUAGE, ...LANGUAGE_CODES])
    .transform((language) => (language === SAME_LANGUAGE ? null : language)),
});

export const compressorSchema = z.object({
  file: requiredFile(imageFileSchema, FILE_REQUIRED),
  quality: z.number().int().min(10).max(95),
  format: outputFormat,
  maxDimension: z
    .string()
    .refine(
      (value) => value.trim() === "" || isDimension(value),
      `compressor.invalidMax::max:${MAX_IMAGE_DIMENSION}`,
    )
    .transform(toDimension),
});

export const imageConverterSchema = z.object({
  file: requiredFile(imageFileSchema, FILE_REQUIRED),
  format: z.enum(["webp", "png", "jpg", "svg"]),
});

export const resizerSchema = z
  .object({
    file: requiredFile(imageFileSchema, FILE_REQUIRED),
    width: z.string(),
    height: z.string(),
    lockRatio: z.boolean(),
    fit: z.enum(FIT_MODES),
    format: outputFormat,
  })
  .superRefine(({ width, height }, ctx) => {
    const message = `resizer.invalidSize::max:${MAX_IMAGE_DIMENSION}`;
    const noWidth = width.trim() === "";
    const noHeight = height.trim() === "";

    if (!noWidth && !isDimension(width)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["width"], message });
    }
    if (!noHeight && !isDimension(height)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["height"], message });
    }
    if (noWidth && noHeight) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["width"], message });
    }
  })
  .transform(({ width, height, lockRatio, fit, ...values }) => {
    const parsedWidth = toDimension(width);
    const parsedHeight = toDimension(height);
    // With the ratio locked, only one side is sent and the service keeps the ratio.
    return lockRatio
      ? {
          ...values,
          width: parsedWidth,
          height: parsedWidth ? null : parsedHeight,
          fit: null,
        }
      : { ...values, width: parsedWidth, height: parsedHeight, fit };
  });

export const mergeSchema = z.object({
  files: z
    .array(z.object({ file: pdfFileSchema }))
    .min(2, "pdf.merge.needTwo")
    .max(MAX_MERGE_FILES, `pdf.merge.tooMany::count:${MAX_MERGE_FILES}`),
});

export const splitSchema = z
  .object({
    file: requiredFile(pdfFileSchema, FILE_REQUIRED),
    mode: z.enum(SPLIT_MODES),
    ranges: z.string().trim(),
    singleFile: z.boolean(),
  })
  .superRefine(({ mode, ranges }, ctx) => {
    if (mode === "ranges" && !ranges) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ranges"],
        message: "pdf.split.rangesRequired",
      });
    }
  });

// Form values (what the fields hold) and what the resolver hands to submit.
export type ConverterValues = z.input<typeof converterSchema>;
export type ConverterOutput = z.output<typeof converterSchema>;
export type ExtractorValues = z.input<typeof extractorSchema>;
export type ExtractorOutput = z.output<typeof extractorSchema>;
export type SummarizerValues = z.input<typeof summarizerSchema>;
export type SummarizerOutput = z.output<typeof summarizerSchema>;
export type CompressorValues = z.input<typeof compressorSchema>;
export type CompressorOutput = z.output<typeof compressorSchema>;
export type ImageConverterValues = z.input<typeof imageConverterSchema>;
export type ImageConverterOutput = z.output<typeof imageConverterSchema>;
export type ResizerValues = z.input<typeof resizerSchema>;
export type ResizerOutput = z.output<typeof resizerSchema>;
export type MergeValues = z.input<typeof mergeSchema>;
export type MergeOutput = z.output<typeof mergeSchema>;
export type SplitValues = z.input<typeof splitSchema>;
export type SplitOutput = z.output<typeof splitSchema>;
