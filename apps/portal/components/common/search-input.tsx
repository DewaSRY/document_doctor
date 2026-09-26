import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props extends ComponentProps<"div"> {
  search: string;
  onSearch: (value: string) => void;
  placeholder?: string;
  addonText?: string;
  addon?: boolean;
  icon?: ReactNode;
}

export function SearchInput({
  search,
  onSearch,
  placeholder,
  addonText,
  addon,
  className,
  icon,
}: Props) {
  const { t } = useTranslation("common");

  return (
    <InputGroup className={cn(className)}>
      <InputGroupInput
        placeholder={placeholder ?? t("searchPlaceholder")}
        value={search}
        onChange={(e) => onSearch(e.target.value)}
      />
      <InputGroupAddon>{icon ?? <Search />}</InputGroupAddon>
      {addon && (
        <InputGroupAddon align="inline-end">{addonText}</InputGroupAddon>
      )}
    </InputGroup>
  );
}
