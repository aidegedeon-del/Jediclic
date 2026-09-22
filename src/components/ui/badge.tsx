import { cn } from "@/lib/utils";

const styles = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  official: "bg-primary/8 text-primary",
  ai: "bg-accent-soft text-accent",
};

export function Badge({
  children,
  variant = "default",
  className,
  // role "status" pour les badges dynamiques (loading, success, error)
  role,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  variant?: keyof typeof styles;
  className?: string;
  role?: string;
  "aria-label"?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[variant],
        className
      )}
      role={role}
      aria-label={ariaLabel}
    >
      {children}
    </span>
  );
}
