import { ImageFormatConverter, SINGLE_IMAGE_CONVERSIONS } from "@/feature/tools";
import { ToolPage, toolMetadata } from "../../_tools/tool-page";

const conversion = SINGLE_IMAGE_CONVERSIONS.find((item) => item.id === "jpg-to-png")!;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/convert-image/jpg-to-png">) {
  const { locale } = await params;
  return toolMetadata(locale, "jpg-to-png");
}

export default async function JpgToPngPage({
  params,
}: PageProps<"/[locale]/convert-image/jpg-to-png">) {
  const { locale } = await params;
  return (
    <ToolPage locale={locale} tool="jpg-to-png">
      <ImageFormatConverter {...conversion} />
    </ToolPage>
  );
}
