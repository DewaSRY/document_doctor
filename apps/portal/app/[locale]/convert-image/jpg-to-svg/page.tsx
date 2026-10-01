import { ImageFormatConverter, SINGLE_IMAGE_CONVERSIONS } from "@/feature/tools";
import { ToolPage, toolMetadata } from "../../_tools/tool-page";

const conversion = SINGLE_IMAGE_CONVERSIONS.find((item) => item.id === "jpg-to-svg")!;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/convert-image/jpg-to-svg">) {
  const { locale } = await params;
  return toolMetadata(locale, "jpg-to-svg");
}

export default async function JpgToSvgPage({
  params,
}: PageProps<"/[locale]/convert-image/jpg-to-svg">) {
  const { locale } = await params;
  return (
    <ToolPage locale={locale} tool="jpg-to-svg">
      <ImageFormatConverter {...conversion} />
    </ToolPage>
  );
}
