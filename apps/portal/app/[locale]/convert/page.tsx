import { Converter } from "@/feature/tools";
import { ToolPage, toolMetadata } from "../_tools/tool-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/convert">) {
  const { locale } = await params;
  return toolMetadata(locale, "converter");
}

export default async function ConvertPage({ params }: PageProps<"/[locale]/convert">) {
  const { locale } = await params;

  return (
    <ToolPage locale={locale} tool="converter">
      <Converter />
    </ToolPage>
  );
}
