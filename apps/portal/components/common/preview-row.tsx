import type { ReactNode } from "react";

interface Props {
  label: ReactNode;
  value: ReactNode;
  subValue?: ReactNode;
}

export function PreviewRow({ label, value, subValue }: Props) {
  return (
    <div className="flex flex-col">
      <span className="text-sm text-muted-foreground">{label}</span>
      {subValue ? (
        <div className="text-right">
          <p className="font-medium">{value}</p>
          <p className="text-sm text-muted-foreground">{subValue}</p>
        </div>
      ) : (
        <p className="text-lg font-medium">{value}</p>
      )}
    </div>
  );
}
