import { PdfTools } from "@/feature/tools";
import { ToolPage, toolMetadata } from "../_tools/tool-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/pdf">) {
  const { locale } = await params;
  return toolMetadata(locale, "pdf");
}

export default async function PdfPage({ params }: PageProps<"/[locale]/pdf">) {
  const { locale } = await params;

  return (
    <ToolPage locale={locale} tool="pdf">
      <PdfTools />
    </ToolPage>
  );
}
