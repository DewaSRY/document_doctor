import { notFound } from "next/navigation";
import { isAppLocale } from "@/i18n/settings";
import { Extractor } from "@/feature/tools";
import { ToolPage, toolMetadata } from "../_tools/tool-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/extract">) {
  const { locale } = await params;
  return toolMetadata(locale, "extractor", "/extract");
}

export default async function ExtractPage({ params }: PageProps<"/[locale]/extract">) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  return (
    <ToolPage>
      <Extractor />
    </ToolPage>
  );
}
