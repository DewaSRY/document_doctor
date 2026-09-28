import { ImageCompressor } from "@/feature/tools";
import { ToolPage, toolMetadata } from "../_tools/tool-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/compress-image">) {
  const { locale } = await params;
  return toolMetadata(locale, "compressor");
}

export default async function CompressImagePage({ params }: PageProps<"/[locale]/compress-image">) {
  const { locale } = await params;

  return (
    <ToolPage locale={locale} tool="compressor">
      <ImageCompressor />
    </ToolPage>
  );
}
