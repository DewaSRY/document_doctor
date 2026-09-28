import { TranslateWizard } from "@/feature/translator";
import { ToolPage, toolMetadata } from "../_tools/tool-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/translate">) {
  const { locale } = await params;
  return toolMetadata(locale, "translator");
}

export default async function TranslatePage({ params }: PageProps<"/[locale]/translate">) {
  const { locale } = await params;

  return (
    <ToolPage locale={locale} tool="translator" contained={false}>
      <TranslateWizard />
    </ToolPage>
  );
}
