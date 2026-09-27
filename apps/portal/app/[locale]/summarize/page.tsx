import { notFound } from "next/navigation";
import { isAppLocale } from "@/i18n/settings";
import { Summarizer } from "@/feature/tools";
import { ToolPage, toolMetadata } from "../_tools/tool-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/summarize">) {
  const { locale } = await params;
  return toolMetadata(locale, "summarizer", "/summarize");
}

export default async function SummarizePage({ params }: PageProps<"/[locale]/summarize">) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  return (
    <ToolPage>
      <Summarizer />
    </ToolPage>
  );
}
