import { ImageFormatConverter, SINGLE_IMAGE_CONVERSIONS } from "@/feature/tools";
import { ToolPage, toolMetadata } from "../../_tools/tool-page";

const conversion = SINGLE_IMAGE_CONVERSIONS.find((item) => item.id === "jpg-to-webp")!;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/convert-image/jpg-to-webp">) {
  const { locale } = await params;
  return toolMetadata(locale, "jpg-to-webp");
}

export default async function JpgToWebpPage({
  params,
}: PageProps<"/[locale]/convert-image/jpg-to-webp">) {
  const { locale } = await params;
  return (
    <ToolPage locale={locale} tool="jpg-to-webp">
      <ImageFormatConverter {...conversion} />
    </ToolPage>
  );
}
