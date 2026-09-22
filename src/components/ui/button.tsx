import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-soft hover:bg-primary/92 active:bg-primary/85",
  secondary:
    "border border-border-strong bg-card text-foreground hover:bg-muted active:bg-muted/80",
  ghost: "bg-transparent text-foreground hover:bg-muted active:bg-muted/80",
  danger: "bg-danger text-white shadow-soft hover:bg-danger/90 active:bg-danger/80",
  link: "bg-transparent text-primary underline-offset-4 hover:underline p-0 h-auto",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm rounded-md min-w-[2rem]",
  md: "h-10 px-4 text-sm rounded-lg min-w-[2.5rem]",
  lg: "h-12 px-6 text-base rounded-lg min-w-[3rem]",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }
>(({ className, variant = "primary", size = "md", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      // Taille minimale zone cliquable (WCAG 2.5.5 : 44×44 px visés)
      "tap-highlight-none inline-flex items-center justify-center gap-2 font-medium transition-all duration-150",
      "disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
      // Focus visible robuste (WCAG 2.4.7 + 2.4.11)
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      variant !== "link" && sizes[size],
      variants[variant],
      className
    )}
    {...props}
  />
));
Button.displayName = "Button";
