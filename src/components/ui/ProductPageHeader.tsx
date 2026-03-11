import React from "react";
import { cn } from "../../lib/utils";

interface ProductPageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
}

export const ProductPageHeader: React.FC<ProductPageHeaderProps> = ({
  title,
  subtitle,
  actions,
  className,
  contentClassName,
  titleClassName,
  subtitleClassName,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-start md:justify-between",
        className,
      )}
    >
      <div className={cn("space-y-2", contentClassName)}>
        <h1
          className={cn(
            "product-page-title text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl",
            titleClassName,
          )}
        >
          {title}
        </h1>
        {subtitle ? (
          <p
            className={cn(
              "product-page-subtitle text-sm sm:text-base",
              subtitleClassName,
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </div>
  );
};

export default ProductPageHeader;