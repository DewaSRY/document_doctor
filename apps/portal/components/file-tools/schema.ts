import { z } from "zod";

import { getFileExtension } from "@/feature/tools/constants";

export interface FileRules {
  extensions: readonly string[];
  maxSize: number;
  /** Message keys, in the namespace of the form that uses the schema. */
  messages: { type: string; tooLarge: string; empty: string };
}

/** A file that passes a tool's type and size rules. Size issues carry their
 *  i18n params in `params`, so the error can name the file. */
export function fileSchema({ extensions, maxSize, messages }: FileRules) {
  return z.instanceof(File).superRefine((file, ctx) => {
    const params = { name: file.name, size: maxSize / 1024 / 1024 };

    if (!extensions.includes(getFileExtension(file.name))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: messages.type });
    } else if (file.size > maxSize) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: messages.tooLarge, params });
    } else if (file.size === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: messages.empty, params });
    }
  });
}

/** A form's file field: null until a file is picked, required on submit. */
export function requiredFile<T extends z.ZodType<File>>(schema: T, message: string) {
  return schema
    .nullable()
    .refine((file: z.output<T> | null): file is z.output<T> => file !== null, message);
}
