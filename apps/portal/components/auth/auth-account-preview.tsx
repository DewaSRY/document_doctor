"use client";

import { Fragment } from "react";
import { AlertCircle, CheckCircle2, Wallet } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { useRouter } from "@/i18n/navigation";
import { useProfileQuery } from "@/feature/auth";
import { useAccounts } from "@/feature/account";
import { getApiErrorMessage } from "@/lib/api/error";
import { AuthBackdrop } from "@/components/auth/auth-backdrop";
import { AccountListItem } from "@/components/dashboard/account-card";
import { AccountCardSkeleton } from "@/components/dashboard/account-card-skeleton";
import { AccountListMessage } from "@/components/dashboard/account-list-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function formatMemberSince(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return createdAt;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    date,
  );
}

export function AuthAccountPreview() {
  const { t } = useTranslation("auth");
  const { t: tCommon } = useTranslation("common");
  const router = useRouter();

  const profileQuery = useProfileQuery();
  const accountsQuery = useAccounts({ page: 1, limit: 10 });

  const profile = profileQuery.data?.data;
  const accounts = accountsQuery.data?.data;

  return (
    <AuthBackdrop>
      <div className="w-full   flex items-center justify-center px-4">
        <Card className="w-full z-1 sm:px-4 0 sm:min-w-150 max-w-2xl py-4 max-h-[80vh] flex flex-col overflow-hidden space-y-6">
          <div className="flex flex-col items-center gap-3 text-center shrink-0">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex size-14 items-center justify-center"
            >
              <span className="absolute inset-0 rounded-full border-4 border-brand/20" />
              <CheckCircle2
                className="size-8 text-brand-700 dark:text-brand"
                aria-hidden
              />
            </motion.div>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                {profile
                  ? t("previewWelcomeTitle", { username: profile.username })
                  : t("authSuccessTitle")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t("previewWelcomeSubtitle")}
              </p>
            </div>
          </div>

          <CardContent className="flex-1 space-y-6 overflow-y-auto">
            <div className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                {t("previewUserSectionTitle")}
              </h2>
              <Card>
                <CardContent className="space-y-3">
                  {profileQuery.isPending && (
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-52" />
                    </div>
                  )}
                  {profileQuery.isError && (
                    <p className="text-sm text-destructive">
                      {getApiErrorMessage(
                        profileQuery.error,
                        tCommon("error.description"),
                      )}
                    </p>
                  )}
                  {profile && (
                    <>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-muted-foreground">
                          {t("username")}
                        </span>
                        <p className="font-medium break-all text-right">
                          {profile.username}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-muted-foreground">
                          {t("email")}
                        </span>
                        <p className="font-medium break-all text-right">
                          {profile.email}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-muted-foreground">
                          {t("memberSince")}
                        </span>
                        <p className="font-medium text-right">
                          {formatMemberSince(profile.created_at)}
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                {t("previewAccountsSectionTitle")}
              </h2>
              {accountsQuery.isPending && <AccountCardSkeleton />}
              {accountsQuery.isError && (
                <AccountListMessage
                  icon={AlertCircle}
                  className="text-destructive"
                >
                  {getApiErrorMessage(
                    accountsQuery.error,
                    tCommon("loadAccountsError"),
                  )}
                </AccountListMessage>
              )}
              {accounts && accounts.length === 0 && (
                <AccountListMessage icon={Wallet}>
                  {tCommon("noAccounts")}
                </AccountListMessage>
              )}
              {accounts && accounts.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {accounts.map((account) => (
                    <Fragment key={account.id}>
                      <AccountListItem account={account} />
                    </Fragment>
                  ))}
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className="shrink-0 border-t-0  bg-transparent pb-4 px-(--card-spacing)">
            <Button
              type="button"
              size="lg"
              className="h-11 w-full"
              onClick={() => router.push("/dashboard")}
            >
              {t("previewGoToDashboard")}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </AuthBackdrop>
  );
}
