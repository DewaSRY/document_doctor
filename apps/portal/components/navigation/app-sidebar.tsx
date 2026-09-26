"use client";

import * as React from "react";
import Link from "next/link";
import { IconWallet } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavAccountList } from "./nav-account-list";
import { Separator } from "@base-ui/react";

import { CreateNewAccount } from "../create-account-model/create-new-account";
import { DepositeSideModel } from "@/components/deposite-model/deposite-side-model";
import { TransferSideModel } from "@/components/transfer-modal/transfer-side-model";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { t, i18n } = useTranslation("common");

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-4! p-2!"
              render={<Link href={`/${i18n.language}/dashboard`} />}
            >
              <span className="flex size-7 items-center justify-center rounded-xs bg-primary text-primary-foreground">
                <IconWallet className="size-4!" />
              </span>
              <span className="text-base font-semibold tracking-tight">
                {t("appName")}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="gap-4 px-1!">
        <Separator />
        <div className="flex flex-col gap-1 px-2">
          <CreateNewAccount />
          <DepositeSideModel />
          <TransferSideModel />
        </div>

        <Separator />
        <NavAccountList />
      </SidebarContent>
      <SidebarFooter></SidebarFooter>
    </Sidebar>
  );
}
