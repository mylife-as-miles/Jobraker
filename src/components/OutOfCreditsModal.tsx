import React, { useState, useEffect, useCallback } from "react";
import { X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/toast";
import { supabase } from "@/lib/supabaseClient";

export interface OutOfCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threshold?: number;
  onBuyPacks?: () => void;
  onSuccess?: (amount: number, credits: number) => void;
}

export interface RefillOption {
  id: string;
  price: number;
  credits: number;
  isPopular?: boolean;
}

export const REFILL_OPTIONS: RefillOption[] = [
  { id: "refill_20", price: 20, credits: 400 },
  { id: "refill_40", price: 40, credits: 800 },
  { id: "refill_90", price: 90, credits: 1800 },
  { id: "refill_150", price: 150, credits: 3000, isPopular: true },
  { id: "refill_300", price: 300, credits: 6000 },
];

export const AUTO_REFILL_STORAGE_KEY = "jobraker_auto_refill_settings";

export function getStoredAutoRefillSettings() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTO_REFILL_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as {
      enabled: boolean;
      threshold: number;
      amountUsd: number;
      credits: number;
      updatedAt: string;
    };
  } catch {
    return null;
  }
}

export function OutOfCreditsModal({
  open,
  onOpenChange,
  threshold = 300,
  onBuyPacks,
  onSuccess,
}: OutOfCreditsModalProps) {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [selectedOptionId, setSelectedOptionId] = useState<string>("refill_150");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedOption =
    REFILL_OPTIONS.find((opt) => opt.id === selectedOptionId) || REFILL_OPTIONS[3];

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleBuyCreditPacks = () => {
    handleClose();
    if (onBuyPacks) {
      onBuyPacks();
    } else {
      navigate("/dashboard/billing?tab=packs");
    }
  };

  const handleEnableAutoRefill = async () => {
    setIsSubmitting(true);
    try {
      const config = {
        enabled: true,
        threshold,
        amountUsd: selectedOption.price,
        credits: selectedOption.credits,
        updatedAt: new Date().toISOString(),
      };

      // Save to localStorage for instant UI reactivity
      window.localStorage.setItem(AUTO_REFILL_STORAGE_KEY, JSON.stringify(config));

      // Attempt to save preference in profiles table if session exists
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (userId) {
          await supabase
            .from("profiles")
            .update({
              socials: {
                auto_refill: config,
              },
              updated_at: new Date().toISOString(),
            } as any)
            .eq("id", userId);
        }
      } catch (err) {
        console.warn("[OutOfCreditsModal] Could not sync to profile:", err);
      }

      notify({
        title: "Auto-refill enabled",
        description: `Your balance will automatically top up with ${selectedOption.credits.toLocaleString()} credits ($${selectedOption.price}) when dropping below ${threshold}.`,
        variant: "success",
      });

      if (onSuccess) {
        onSuccess(selectedOption.price, selectedOption.credits);
      }
      handleClose();
    } catch (err: any) {
      notify({
        title: "Could not enable auto-refill",
        description: err?.message || "Please try again or contact support.",
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className='fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[calc(100%-2rem)] max-w-[460px] p-0 overflow-hidden border border-white/10 bg-[#121316] text-white shadow-[0_25px_70px_rgba(0,0,0,0.8)] rounded-[28px] z-50 focus:outline-none'
      >
        <DialogTitle className='sr-only'>Out of credits</DialogTitle>
        <DialogDescription className='sr-only'>
          Automatically refill your credits when they drop below {threshold} to keep generating flawlessly.
        </DialogDescription>

        <div className='relative p-6 sm:p-7'>
          {/* Top-right close button */}
          <button
            type='button'
            onClick={handleClose}
            aria-label='Close'
            className='absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors cursor-pointer z-10'
          >
            <X className='h-4 w-4' />
          </button>

          {/* Center 3D Metallic Coins Icon */}
          <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-b from-white/15 via-white/5 to-white/0 shadow-[inset_0_1px_2px_rgba(255,255,255,0.25)]'>
            <svg
              width='38'
              height='34'
              viewBox='0 0 38 34'
              fill='none'
              xmlns='http://www.w3.org/2000/svg'
              className='drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]'
            >
              <defs>
                <linearGradient id='coinBackGrad' x1='0%' y1='0%' x2='100%' y2='100%'>
                  <stop offset='0%' stopColor='#ffffff' />
                  <stop offset='25%' stopColor='#d1d5db' />
                  <stop offset='70%' stopColor='#6b7280' />
                  <stop offset='100%' stopColor='#374151' />
                </linearGradient>
                <linearGradient id='coinFrontGrad' x1='0%' y1='0%' x2='100%' y2='100%'>
                  <stop offset='0%' stopColor='#ffffff' />
                  <stop offset='20%' stopColor='#e5e7eb' />
                  <stop offset='60%' stopColor='#9ca3af' />
                  <stop offset='100%' stopColor='#4b5563' />
                </linearGradient>
                <filter id='coinShadowFilter' x='-20%' y='-20%' width='140%' height='140%'>
                  <feDropShadow dx='0' dy='1.5' stdDeviation='1.5' floodColor='#000000' floodOpacity='0.5' />
                </filter>
              </defs>
              {/* Back Coin */}
              <g filter='url(#coinShadowFilter)'>
                <circle cx='15' cy='15' r='11' fill='url(#coinBackGrad)' stroke='#9ca3af' strokeWidth='0.75' />
                <circle cx='15' cy='15' r='8' fill='none' stroke='#e5e7eb' strokeWidth='0.5' strokeOpacity='0.7' />
              </g>
              {/* Front Coin */}
              <g filter='url(#coinShadowFilter)'>
                <circle cx='23' cy='18' r='11' fill='url(#coinFrontGrad)' stroke='#e5e7eb' strokeWidth='0.75' />
                <circle cx='23' cy='18' r='8' fill='none' stroke='#ffffff' strokeWidth='0.5' strokeOpacity='0.85' />
              </g>
            </svg>
          </div>

          {/* Heading and Subtitle */}
          <h2 className='text-center text-2xl font-bold tracking-tight text-white mb-2'>
            Out of credits
          </h2>
          <p className='mx-auto max-w-[340px] text-center text-sm leading-relaxed text-neutral-400 mb-6'>
            Automatically refill your credits when they drop below {threshold} to keep generating flawlessly.
          </p>

          {/* Refill Amount Header */}
          <div className='mb-3 flex items-center justify-between px-0.5 text-sm'>
            <span className='font-medium text-neutral-300'>Choose a refill amount</span>
            <span className='text-xs font-medium text-neutral-400'>$1 = 20 credits</span>
          </div>

          {/* Refill Options Grid */}
          <div className='space-y-2.5 mb-2.5'>
            {/* Top Row: 4 items */}
            <div className='grid grid-cols-4 gap-2.5'>
              {REFILL_OPTIONS.slice(0, 4).map((option) => {
                const isSelected = selectedOptionId === option.id;
                return (
                  <button
                    key={option.id}
                    type='button'
                    onClick={() => setSelectedOptionId(option.id)}
                    className={`group relative flex flex-col items-center justify-center rounded-2xl p-3 text-center transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? "border-2 border-[#d4ff00] bg-[#1a1d24] shadow-[0_0_20px_rgba(212,255,0,0.18)]"
                        : "border border-white/10 bg-[#1a1d24]/90 hover:border-white/20 hover:bg-[#222630]"
                    }`}
                  >
                    <span
                      className={`text-lg font-bold transition-colors ${
                        isSelected ? "text-[#d4ff00]" : "text-white group-hover:text-white"
                      }`}
                    >
                      ${option.price}
                    </span>
                    <span
                      className={`mt-1 flex items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                        isSelected ? "text-[#d4ff00]" : "text-neutral-400"
                      }`}
                    >
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${
                          isSelected ? "bg-[#d4ff00]" : "bg-neutral-400"
                        }`}
                      />
                      {option.credits.toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Bottom Row: 1 item (left-aligned) */}
            <div className='grid grid-cols-4 gap-2.5'>
              {REFILL_OPTIONS.slice(4, 5).map((option) => {
                const isSelected = selectedOptionId === option.id;
                return (
                  <button
                    key={option.id}
                    type='button'
                    onClick={() => setSelectedOptionId(option.id)}
                    className={`group relative flex flex-col items-center justify-center rounded-2xl p-3 text-center transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? "border-2 border-[#d4ff00] bg-[#1a1d24] shadow-[0_0_20px_rgba(212,255,0,0.18)]"
                        : "border border-white/10 bg-[#1a1d24]/90 hover:border-white/20 hover:bg-[#222630]"
                    }`}
                  >
                    <span
                      className={`text-lg font-bold transition-colors ${
                        isSelected ? "text-[#d4ff00]" : "text-white group-hover:text-white"
                      }`}
                    >
                      ${option.price}
                    </span>
                    <span
                      className={`mt-1 flex items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                        isSelected ? "text-[#d4ff00]" : "text-neutral-400"
                      }`}
                    >
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${
                          isSelected ? "bg-[#d4ff00]" : "bg-neutral-400"
                        }`}
                      />
                      {option.credits.toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Credits Validity Info */}
          <p className='px-0.5 text-xs text-neutral-400 mb-6'>
            Credits are valid for 90 days once added
          </p>

          {/* Action Buttons */}
          <div className='grid grid-cols-2 gap-3 mb-4'>
            <button
              type='button'
              onClick={handleBuyCreditPacks}
              className='w-full rounded-full bg-white py-3.5 px-4 text-sm font-bold text-black shadow-md transition-all hover:bg-neutral-200 active:scale-[0.98] cursor-pointer'
            >
              Buy credit packs
            </button>
            <button
              type='button'
              disabled={isSubmitting}
              onClick={handleEnableAutoRefill}
              className='w-full rounded-full bg-[#d4ff00] py-3.5 px-4 text-sm font-bold text-black shadow-[0_0_20px_rgba(212,255,0,0.25)] transition-all hover:bg-[#c4ed00] active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2'
            >
              {isSubmitting ? (
                <>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  Enabling...
                </>
              ) : (
                "Enable auto-refill"
              )}
            </button>
          </div>

          {/* Legal / Terms Footer */}
          <p className='text-center text-[11px] leading-relaxed text-neutral-400'>
            By clicking “Enable auto-refill” you agree to our{" "}
            <a
              href='/terms'
              target='_blank'
              rel='noreferrer'
              className='text-[#d4ff00] hover:underline font-medium'
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href='/privacy'
              target='_blank'
              rel='noreferrer'
              className='text-[#d4ff00] hover:underline font-medium'
            >
              Privacy Policy
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default OutOfCreditsModal;
