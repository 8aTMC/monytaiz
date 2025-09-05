import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-medium transition-smooth ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-soft hover:shadow-glow",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-soft",
        outline: "border border-border bg-transparent hover:bg-secondary/50 text-foreground hover:text-foreground",
        secondary: "relative overflow-hidden bg-gradient-to-r from-secondary to-secondary/90 bg-[length:200%_100%] text-secondary-foreground hover:scale-[1.02] hover:bg-gradient-shift shadow-soft hover:shadow-lg transition-all duration-300 ease-out hover:animate-border-glow [&>*]:transition-transform [&>*]:duration-300 hover:[&>*]:translate-x-0.5",
        ghost: "hover:bg-secondary/50 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        hero: "bg-gradient-primary text-primary-foreground hover:scale-105 shadow-glow hover:shadow-glow transition-bounce font-semibold",
        premium: "bg-gradient-hero text-primary-foreground hover:scale-105 shadow-glow transition-bounce font-semibold",
        aiz: "relative overflow-hidden bg-gradient-aiz text-primary-foreground hover:scale-105 shadow-glow hover:shadow-hover transition-bounce font-semibold before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:translate-x-[-100%] hover:before:animate-slide-shine",
        gold: "bg-gold text-gold-foreground hover:bg-gold/90 shadow-soft hover:shadow-glow font-semibold",
        glass: "bg-gradient-glass backdrop-blur-sm border border-primary/20 text-foreground hover:bg-primary/10 hover:border-primary/40",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-5 text-base",
        xl: "h-12 px-6 text-lg",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
