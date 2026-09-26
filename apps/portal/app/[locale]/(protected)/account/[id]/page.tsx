import { notFound } from "next/navigation";
import {
  QueryClient,
  HydrationBoundary,
  dehydrate,
} from "@tanstack/react-query";
import { isAppLocale } from "@/i18n/settings";

import {
  queryKeys as accountQueryKeys,
  detailAccountAction,
} from "@/feature/account-manage";
import {
  queryKeys as accountTransactionQueryKeys,
  getAccountEntriesAction,
} from "@/feature/account-transaction";

import { unpackActionResult } from "@/lib/api/unpack-server-result";

import { AccountDetailView } from "@/components/account/account-detail-view";
import { ParamsSearchParams, parseIntParam } from "@/feature/common";

interface params extends PageProps<"/[locale]/account/[id]"> {
  searchParams: Promise<ParamsSearchParams>;
}

function getSearchParams(searchParams: ParamsSearchParams) {
  return {
    page: parseIntParam(searchParams.page, 1),
    limit: parseIntParam(searchParams.limit, 25),
  };
}

export default async function AccountDetailPage({
  params,
  searchParams,
}: params) {
  const { locale, id } = await params;
  const { page, limit } = getSearchParams(await searchParams);
  if (!isAppLocale(locale)) {
    notFound();
  }

  const accountId = Number(id);
  if (!Number.isInteger(accountId) || accountId <= 0) {
    notFound();
  }

  const queryClient = new QueryClient();

  await queryClient.query({
    queryKey: accountTransactionQueryKeys.entries(accountId, {
      limit: limit,
      page: page,
    }),
    queryFn: () =>
      getAccountEntriesAction(accountId, {
        limit: limit,
        page: page,
      }).then(unpackActionResult),
  });

  await queryClient.query({
    queryKey: accountQueryKeys.manageAccount(accountId),
    queryFn: () => detailAccountAction(accountId).then(unpackActionResult),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AccountDetailView accountId={accountId} />
    </HydrationBoundary>
  );
}
