import { notFound } from "next/navigation";
import { isAppLocale } from "@/i18n/settings";
import { ImageResizer } from "@/feature/tools";
import { ToolPage, toolMetadata } from "../_tools/tool-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/resize-image">) {
  const { locale } = await params;
  return toolMetadata(locale, "resizer", "/resize-image");
}

export default async function ResizeImagePage({ params }: PageProps<"/[locale]/resize-image">) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  return (
    <ToolPage>
      <ImageResizer />
    </ToolPage>
  );
}
