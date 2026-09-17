import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold cursor-pointer transition-[background-color,border-color,color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-soft hover:bg-primary/92",
        destructive: "border border-status-danger bg-status-danger-soft text-status-danger-strong shadow-soft hover:bg-status-danger/85",
        outline:
          "border border-input bg-card text-foreground shadow-soft hover:bg-surface",
        secondary: "border border-border bg-secondary text-secondary-foreground shadow-soft hover:bg-muted",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        brand: "bg-brand text-brand-foreground shadow-soft hover:bg-brand/92",
        hero: "bg-brand text-brand-foreground shadow-card hover:-translate-y-0.5 hover:shadow-lift",
        soft: "border border-brand-glow bg-brand-soft text-brand hover:bg-brand-glow/70",
        subtle:
          "border border-border bg-card text-foreground shadow-soft hover:border-brand/40 hover:text-brand transition-all",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-6 text-[0.95rem]",
        xl: "h-12 rounded-xl px-8 text-base",
        icon: "h-10 w-10",
      },

    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
