import { useEffect } from "react";
import { isSecuredTextControl, secureTextControl } from "@/lib/inputSecurity";

export function InputSecurityGuard() {
  useEffect(() => {
    const onInput = (event: Event) => {
      if (!isSecuredTextControl(event.target)) return;
      secureTextControl(event.target, { trim: false });
    };

    const onBlur = (event: Event) => {
      if (!isSecuredTextControl(event.target)) return;
      secureTextControl(event.target, { trim: true });
    };

    const onSubmit = (event: Event) => {
      if (!(event.target instanceof HTMLFormElement)) return;

      for (const element of Array.from(event.target.elements)) {
        if (!isSecuredTextControl(element)) continue;
        const result = secureTextControl(element, { trim: true });
        if (result.validationMessage) {
          element.reportValidity();
          event.preventDefault();
          break;
        }
      }
    };

    document.addEventListener("input", onInput, true);
    document.addEventListener("blur", onBlur, true);
    document.addEventListener("submit", onSubmit, true);

    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("blur", onBlur, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  return null;
}

export default InputSecurityGuard;
