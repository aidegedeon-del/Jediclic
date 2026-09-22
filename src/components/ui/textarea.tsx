import { cn } from "@/lib/utils";
import { TextareaHTMLAttributes, forwardRef } from "react";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-24 w-full rounded-lg border border-border-strong bg-card px-3 py-2 text-sm text-foreground outline-none",
        "transition-shadow placeholder:text-muted-foreground/70",
        // Focus visible (WCAG 2.4.7 + 2.4.11)
        "focus:border-accent/50 focus:ring-2 focus:ring-accent/20",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
