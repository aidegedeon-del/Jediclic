import { cn } from "@/lib/utils";
import { SelectHTMLAttributes, forwardRef } from "react";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        // h-11 = 44px pour satisfaire WCAG 2.5.5
        "h-11 w-full rounded-lg border border-border-strong bg-card px-3 text-sm text-foreground outline-none",
        "transition-shadow",
        // Focus visible (WCAG 2.4.7 + 2.4.11)
        "focus:border-accent/50 focus:ring-2 focus:ring-accent/20",
        className
      )}
      {...props}
    />
  )
);
Select.displayName = "Select";
