import React from "react";
import { Button } from "./button";

type Action = {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
};

export type EmptyStateProps = {
  title: string;
  description?: string;
  illustrationSrc?: string;
  primaryAction?: Action;
  secondaryAction?: Action;
  className?: string;
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  illustrationSrc,
  primaryAction,
  secondaryAction,
  className = "",
}) => {
  const ActionButton: React.FC<Action & { primary?: boolean }> = ({ label, onClick, href, variant, primary }) => {
    const v = variant || (primary ? "primary" : "outline");
    if (href) {
      return (
        <a href={href} onClick={onClick} className="inline-block">
          <Button variant={v as any}>{label}</Button>
        </a>
      );
    }
    return (
      <Button onClick={onClick} variant={v as any}>{label}</Button>
    );
  };

  return (
    <div className={[
      "flex flex-col items-center justify-center rounded-xl border border-[#1dff00]/20 bg-black/30 p-10 text-center backdrop-blur-sm",
      className,
    ].join(" ")}
    >
      {illustrationSrc && (
        <img src={illustrationSrc} alt="" className="mb-4 h-28 w-auto rounded-md opacity-80" />
      )}
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {description && (
        <p className="mt-1 max-w-md text-sm text-white/70">{description}</p>
      )}
      {(primaryAction || secondaryAction) && (
        <div className="mt-4 flex gap-3">
          {primaryAction && <ActionButton {...primaryAction} primary />}
          {secondaryAction && <ActionButton {...secondaryAction} />}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
