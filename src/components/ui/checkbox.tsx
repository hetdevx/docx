import { Check } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & {
  className?: string;
};

export function Checkbox({ checked, className, ...props }: CheckboxProps) {
  return (
    <span
      className={cn(
        "relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
        checked ? "bg-accent border-accent" : "bg-surface border-border-subtle",
        className,
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        {...props}
      />
      {checked && (
        <Check className="pointer-events-none h-3 w-3 text-accent-foreground" strokeWidth={3} />
      )}
    </span>
  );
}
