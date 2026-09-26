import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type IconButtonProps = React.ComponentProps<typeof Button> & {
  text: string;
  icon: React.ReactNode;
  tooltip: string;
  tooltipSide?: React.ComponentProps<typeof TooltipContent>["side"];
  iconPosition?: "left" | "right";
};

export function IconButton({
  text,
  icon,
  tooltip,
  tooltipSide = "top",
  variant = "ghost",

  iconPosition = "left",

  ...props
}: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant={variant}
            aria-label={tooltip}
            {...props}
            className="w-full"
          >
            <div className="flex items-center gap-2 justify-between w-full">
              {iconPosition === "left" && icon}
              <span>{text}</span>
              {iconPosition === "right" && icon}
            </div>
          </Button>
        }
      />
      <TooltipContent side={tooltipSide}>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
