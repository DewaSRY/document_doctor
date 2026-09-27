import { Extractor } from "@/feature/tools";
import { ToolPage, toolMetadata } from "../_tools/tool-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/extract">) {
  const { locale } = await params;
  return toolMetadata(locale, "extractor");
}

export default async function ExtractPage({ params }: PageProps<"/[locale]/extract">) {
  const { locale } = await params;

  return (
    <ToolPage locale={locale} tool="extractor">
      <Extractor />
    </ToolPage>
  );
}
