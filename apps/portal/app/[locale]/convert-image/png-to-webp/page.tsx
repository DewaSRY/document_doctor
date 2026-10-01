import { ImageFormatConverter, SINGLE_IMAGE_CONVERSIONS } from "@/feature/tools";
import { ToolPage, toolMetadata } from "../../_tools/tool-page";

const conversion = SINGLE_IMAGE_CONVERSIONS.find((item) => item.id === "png-to-webp")!;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/convert-image/png-to-webp">) {
  const { locale } = await params;
  return toolMetadata(locale, "png-to-webp");
}

export default async function PngToWebpPage({
  params,
}: PageProps<"/[locale]/convert-image/png-to-webp">) {
  const { locale } = await params;
  return (
    <ToolPage locale={locale} tool="png-to-webp">
      <ImageFormatConverter {...conversion} />
    </ToolPage>
  );
}
