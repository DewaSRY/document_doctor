import { ImageFormatConverter, SINGLE_IMAGE_CONVERSIONS } from "@/feature/tools";
import { ToolPage, toolMetadata } from "../../_tools/tool-page";

const conversion = SINGLE_IMAGE_CONVERSIONS.find((item) => item.id === "png-to-svg")!;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/convert-image/png-to-svg">) {
  const { locale } = await params;
  return toolMetadata(locale, "png-to-svg");
}

export default async function PngToSvgPage({
  params,
}: PageProps<"/[locale]/convert-image/png-to-svg">) {
  const { locale } = await params;
  return (
    <ToolPage locale={locale} tool="png-to-svg">
      <ImageFormatConverter {...conversion} />
    </ToolPage>
  );
}
