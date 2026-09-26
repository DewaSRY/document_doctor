import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";

import { AccountList } from "./account-list";
import { useDepositeStore } from "./store";
import { DepositeForm } from "./deposite-dialog";
interface Props {
  form: DepositeForm;
}

export function AccountStep({ form }: Props) {
  const { t: tCommon } = useTranslation("common");
  const { selectedAccount, setStep } = useDepositeStore();

  return (
    <div>
      <div className="max-h-80 overflow-y-auto">
        <AccountList form={form} />
      </div>

      <DialogFooter>
        <DialogClose
          render={<Button variant="outline">{tCommon("cancel")}</Button>}
        />
        <Button
          type="button"
          disabled={!selectedAccount}
          onClick={() => setStep("details")}
        >
          {tCommon("continue")}
        </Button>
      </DialogFooter>
    </div>
  );
}
