import * as React from "react";
import { cn } from "../../lib/utils";

interface ProductSectionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  emphasis?: "default" | "muted" | "highlighted";
}

export const ProductSectionCard = React.forwardRef<
  HTMLDivElement,
  ProductSectionCardProps
>(({ className, emphasis = "default", ...props }, ref) => {
  const emphasisClasses = {
    default: "product-section-card",
    muted: "product-section-card-muted",
    highlighted: "product-section-card-highlighted",
  } as const;

  return (
    <div
      ref={ref}
      className={cn(emphasisClasses[emphasis], className)}
      {...props}
    />
  );
});

ProductSectionCard.displayName = "ProductSectionCard";

export const ProductSurfaceCard = ProductSectionCard;

export default ProductSectionCard;