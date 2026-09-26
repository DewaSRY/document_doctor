import { useState } from "react";
import { useTranslation } from "react-i18next";

import { IconButton } from "@/components/common/icon-button";
import { CreateAccountDialog } from "@/components/create-account-model/create-account-dialog";
import { Plus } from "lucide-react";

export function CreateNewAccount() {
  const { t } = useTranslation("account");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  return (
    <div>
      <CreateAccountDialog open={isDialogOpen} setOpen={setIsDialogOpen} />
      <IconButton
        text={t("createNewAccount")}
        icon={<Plus className="size-4" />}
        tooltip={t("createNewAccount")}
        onClick={() => setIsDialogOpen(true)}
        className="wrap-break-word!"
        iconPosition="right"
      />
    </div>
  );
}
