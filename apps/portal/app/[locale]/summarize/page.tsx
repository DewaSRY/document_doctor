import { Summarizer } from "@/feature/tools";
import { ToolPage, toolMetadata } from "../_tools/tool-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/summarize">) {
  const { locale } = await params;
  return toolMetadata(locale, "summarizer");
}

export default async function SummarizePage({ params }: PageProps<"/[locale]/summarize">) {
  const { locale } = await params;

  return (
    <ToolPage locale={locale} tool="summarizer">
      <Summarizer />
    </ToolPage>
  );
}
