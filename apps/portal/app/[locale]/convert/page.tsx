import { notFound } from "next/navigation";
import { isAppLocale } from "@/i18n/settings";
import { Converter } from "@/feature/tools";
import { ToolPage, toolMetadata } from "../_tools/tool-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/convert">) {
  const { locale } = await params;
  return toolMetadata(locale, "converter", "/convert");
}

export default async function ConvertPage({ params }: PageProps<"/[locale]/convert">) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  return (
    <ToolPage>
      <Converter />
    </ToolPage>
  );
}
