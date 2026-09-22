import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        // h-11 = 44px pour satisfaire WCAG 2.5.5 (zone cliquable minimale)
        "h-11 w-full rounded-lg border border-border-strong bg-card px-3 text-sm text-foreground outline-none",
        "transition-shadow placeholder:text-muted-foreground/70",
        // Focus visible (WCAG 2.4.7 + 2.4.11)
        "focus:border-accent/50 focus:ring-2 focus:ring-accent/20",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-medium text-foreground/80", className)}
      {...props}
    />
  );
}

export function HelpText({
  id,
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      id={id}
      className={cn("mt-1.5 text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}
