import { useEffect, useState } from "react";
import { X } from "lucide-react";

const DISMISS_KEY = "jobraker_low_credit_banner_dismissed";

type LowCreditsBannerProps = {
  onTopUp: () => void;
};

function readDismissed() {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === "true";
  } catch {
    return false;
  }
}

export function LowCreditsBanner({
  onTopUp,
}: LowCreditsBannerProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  if (dismissed) return null;

  return (
    <aside
      aria-label="Low credit warning"
      className="fixed bottom-20 left-4 right-4 z-[80] mx-auto max-w-[940px] sm:bottom-5"
    >
      <div className="flex min-h-[62px] items-center gap-3 rounded-[1.9rem] border border-white/[0.06] bg-[#1a1a1c]/95 px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.36)] backdrop-blur-xl sm:px-5">
        <span
          aria-hidden="true"
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#ffd166]"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#1a1a1c]" />
        </span>
        <p className="min-w-0 flex-1 truncate text-sm text-white/55 sm:text-[15px]">
          <span className="font-semibold text-white/80">Credits are running low</span>{" "}
          <span className="hidden xs:inline">Over 90% already used</span>
          <span className="xs:hidden">90% used</span>
        </p>
        <button
          type="button"
          onClick={onTopUp}
          className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-transform duration-150 ease-out hover:bg-white/90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1c] sm:px-5"
        >
          Top Up
        </button>
        <button
          type="button"
          onClick={() => {
            try {
              window.sessionStorage.setItem(DISMISS_KEY, "true");
            } catch {
              // Session storage is optional; hiding still works for this render.
            }
            setDismissed(true);
          }}
          className="shrink-0 rounded-full p-2 text-white/40 transition-colors duration-150 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          aria-label="Dismiss low credit warning"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
