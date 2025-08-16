import { i18n } from "@lingui/core";
import dayjs from "dayjs";

import { dayjsLocales } from "./dayjs";

export const defaultLocale = "en-US";

export async function dynamicActivate(locale: string) {
  // In this integration, we skip loading .po files and activate with empty messages
  i18n.loadAndActivate({ locale, messages: {} as Record<string, string> });

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (dayjsLocales[locale]) {
    dayjs.locale(await dayjsLocales[locale]());
  }
}
