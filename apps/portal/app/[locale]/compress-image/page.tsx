import { notFound } from "next/navigation";
import { isAppLocale } from "@/i18n/settings";
import { ImageCompressor } from "@/feature/tools";
import { ToolPage, toolMetadata } from "../_tools/tool-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/compress-image">) {
  const { locale } = await params;
  return toolMetadata(locale, "compressor", "/compress-image");
}

export default async function CompressImagePage({ params }: PageProps<"/[locale]/compress-image">) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  return (
    <ToolPage>
      <ImageCompressor />
    </ToolPage>
  );
}
