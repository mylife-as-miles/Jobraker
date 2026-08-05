import { Hashvatar } from "hashvatar/react";
import { cn } from "@/lib/utils";

const JOBRAKER_TONES = ["#22c55e", "#0f766e", "#84cc16"];

type HashvatarAvatarProps = {
  seed: string | null | undefined;
  size?: number;
  className?: string;
};

/** A deterministic, privacy-friendly avatar used when a profile photo is unavailable. */
export function HashvatarAvatar({
  seed,
  size = 128,
  className,
}: HashvatarAvatarProps) {
  return (
    <span aria-hidden="true" className="block h-full w-full">
      <Hashvatar
        hash={seed?.trim() || "jobraker-user"}
        size={size}
        tones={JOBRAKER_TONES}
        className={cn("h-full w-full", className)}
      />
    </span>
  );
}
