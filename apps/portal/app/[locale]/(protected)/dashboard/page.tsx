import { notFound } from "next/navigation";
import { connection } from "next/server";
import {
  QueryClient,
  HydrationBoundary,
  dehydrate,
} from "@tanstack/react-query";
import { isAppLocale } from "@/i18n/settings";
import { getTranslation } from "@/i18n/server";
import { AccountList } from "@/components/dashboard/account-list";
import { queryKeys, listMeAccountsAction } from "@/feature/account";
import { unpackActionResult } from "@/lib/api/unpack-server-result";

interface props extends PageProps<"/[locale]/dashboard"> {
  searchParams: Promise<{ search?: string }>;
}

export default async function DashboardPage({ params }: props) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  const { t } = await getTranslation(locale, "common");

  // Per-user data: opt out of build-time prerendering so the prefetch below
  // only runs at request time (see BuildPhaseSkippedError).
  await connection();

  const queryClient = new QueryClient();

  // Matches AccountList's own useAccounts({ page: 1, limit: 10 }) call
  // exactly, since TanStack Query hashes the params object into the cache
  // key.
  const query = { page: 1, limit: 10 };
  await queryClient.query({
    queryKey: queryKeys.list(query),
    queryFn: () => listMeAccountsAction(query).then(unpackActionResult),
  });

  return (
    <div className="flex flex-1 flex-col bg-background px-4 py-6 font-sans sm:px-6">
      <div className="mx-auto w-full max-w-[84rem]">
        <div className="flex w-full items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("dashboardTitle")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("yourAccounts")}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <HydrationBoundary state={dehydrate(queryClient)}>
            <AccountList />
          </HydrationBoundary>
        </div>
      </div>
    </div>
  );
}
