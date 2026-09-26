import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DepositeDialog } from "./deposite-dialog";
import { IconButton } from "@/components/common/icon-button";
import { ArrowDownToLine } from "lucide-react";

export function DepositeSideModel() {
  const { t } = useTranslation("deposit");
  const [open, setOpen] = useState(false);

  return (
    <div>
      <DepositeDialog open={open} setOpen={setOpen} />
      <IconButton
        text={t("depositAction")}
        icon={<ArrowDownToLine className="size-4" />}
        tooltip={t("depositTooltip")}
        onClick={() => setOpen(true)}
        className="wrap-break-word!"
        iconPosition="right"
      />
    </div>
  );
}
