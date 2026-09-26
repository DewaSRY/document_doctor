import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAppLocale } from "@/i18n/settings";
import {
  QueryClient,
  HydrationBoundary,
  dehydrate,
} from "@tanstack/react-query";
import { verifySession } from "@/feature/auth/dal";
import { SessionGuard } from "@/feature/auth";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/navigation/app-sidebar";
import { SiteHeader } from "@/components/navigation/site-header";

import { queryKeys, listMeAccountsAction } from "@/feature/account";

import { unpackActionResult } from "@/lib/api/unpack-server-result";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ProtectedLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  await verifySession(locale);

  const queryClient = new QueryClient();

  const query = {
    page: 1,
    limit: 10,
    name: "",
  };
  await queryClient.query({
    queryKey: queryKeys.list(query),
    queryFn: () => listMeAccountsAction(query).then(unpackActionResult),
  });

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <SessionGuard />
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader locale={locale} />

          {children}
        </SidebarInset>
      </HydrationBoundary>
    </SidebarProvider>
  );
}
