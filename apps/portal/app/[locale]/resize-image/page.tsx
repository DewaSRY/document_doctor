import { ImageResizer } from "@/feature/tools";
import { ToolPage, toolMetadata } from "../_tools/tool-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/resize-image">) {
  const { locale } = await params;
  return toolMetadata(locale, "resizer");
}

export default async function ResizeImagePage({ params }: PageProps<"/[locale]/resize-image">) {
  const { locale } = await params;

  return (
    <ToolPage locale={locale} tool="resizer">
      <ImageResizer />
    </ToolPage>
  );
}
