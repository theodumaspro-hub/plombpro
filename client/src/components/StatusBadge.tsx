import { Badge } from "@/components/ui/badge";
import { STATUS_COLORS, statusLabel } from "@/lib/format";

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={`text-[11px] font-medium border-0 ${STATUS_COLORS[status] || "bg-muted text-muted-foreground"}`}>
      {statusLabel(status)}
    </Badge>
  );
}
