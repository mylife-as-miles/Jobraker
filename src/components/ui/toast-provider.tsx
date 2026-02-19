import React from "react";
import { ToastProvider as CoreToastProvider, useToast as useCoreToast } from "./toast";

export const ToastProvider = ({ children }: { children: React.ReactNode }) => (
	<CoreToastProvider>{children}</CoreToastProvider>
);

// Back-compat wrapper to support existing calls like `const { addToast } = useToast()`
export function useToast() {
	const core = useCoreToast();
	return {
		addToast: (opts: { title?: string; description?: React.ReactNode; variant?: string; duration?: number }) => {
			const mapped = opts.variant === "destructive" ? "error" : (opts.variant as any);
			core.notify({ title: opts.title, description: opts.description, variant: mapped, duration: opts.duration });
		},
		// Also expose the richer API if needed downstream
		notify: core.notify,
		success: core.success,
		error: core.error,
		info: core.info,
		warning: core.warning,
	} as const;
}

export default ToastProvider;
