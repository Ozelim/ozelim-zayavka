import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-green-100 text-green-800",
        secondary: "bg-green-50 text-green-700 border border-green-200",
        destructive: "bg-red-100 text-red-700",
        warning: "bg-yellow-100 text-yellow-800",
        outline: "border border-green-300 text-green-700",
        blue: "bg-blue-100 text-blue-800",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
