import { getTranslation } from "@/i18n/server";
import type { AppLocale } from "@/i18n/settings";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export async function LogoutButton({ locale }: { locale: AppLocale }) {
  const { t } = await getTranslation(locale, "auth");

  return (
    <Link href={`/${locale}/logout`}>
      <Button variant="outline" size="sm">
        {t("logout")}
      </Button>
    </Link>
  );
}
