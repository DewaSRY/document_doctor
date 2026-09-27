import { notFound } from "next/navigation";
import { isAppLocale } from "@/i18n/settings";
import { PdfTools } from "@/feature/tools";
import { ToolPage, toolMetadata } from "../_tools/tool-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/pdf">) {
  const { locale } = await params;
  return toolMetadata(locale, "pdf", "/pdf");
}

export default async function PdfPage({ params }: PageProps<"/[locale]/pdf">) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  return (
    <ToolPage>
      <PdfTools />
    </ToolPage>
  );
}
