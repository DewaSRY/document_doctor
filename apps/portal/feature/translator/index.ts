export {
  queryKeys,
  useDocumentSegments,
  useTranslateDocument,
  useUpdateDocumentSegments,
} from "./hooks/query";
export {
  ACCEPT_ATTRIBUTE,
  LANGUAGE_CODES,
  MAX_FILE_SIZE,
  getDownloadHref,
  type LanguageCode,
} from "./constants";
export type {
  DocumentSegment,
  DocumentSegments,
  TranslatedDocument,
} from "./type";
export { TranslatorHeader } from "./components/translator-header";
export { TranslateWizard } from "./components/translate-wizard";
export { SegmentEditor } from "./components/segment-editor";

// `AI_TRANSLATION_API_URL` (./config) is intentionally NOT re-exported: it's
// "server-only", and the barrel is imported by client components. Its route
// handler consumer imports it from "@/feature/translator/config" directly.
