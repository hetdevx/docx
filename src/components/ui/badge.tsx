import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { STATUS_STYLES } from "@/lib/status-styles";
import { cn } from "@/lib/cn";

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", className)}>
      {children}
    </span>
  );
}

const STATUS_ICONS: Record<string, LucideIcon> = {
  pending: Clock,
  processing: Loader2,
  ready: CheckCircle2,
  failed: XCircle,
};

export function StatusBadge({ status }: { status: string }) {
  const Icon = STATUS_ICONS[status] ?? Clock;
  return (
    <Badge className={STATUS_STYLES[status] ?? STATUS_STYLES.pending}>
      <Icon className={`h-3 w-3 ${status === "processing" ? "animate-spin" : ""}`} />
      {status}
    </Badge>
  );
}
