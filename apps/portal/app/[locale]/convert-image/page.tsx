import { ImageConverter } from "@/feature/tools";
import { ToolPage, toolMetadata } from "../_tools/tool-page";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/convert-image">) {
  const { locale } = await params;
  return toolMetadata(locale, "image-converter");
}

export default async function ConvertImagePage({
  params,
}: PageProps<"/[locale]/convert-image">) {
  const { locale } = await params;

  return (
    <ToolPage locale={locale} tool="image-converter">
      <ImageConverter />
    </ToolPage>
  );
}
