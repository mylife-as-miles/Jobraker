import {
  EditorialPortfolioTemplate,
  type EditorialPortfolioProps,
} from "./EditorialPortfolioTemplate";
import { NavigatorPortfolioTemplate as NavigatorPortfolioTemplateClassic } from "./NavigatorPortfolioTemplateClassic";
import { WodniackPortfolioTemplate as KineticPortfolioTemplate } from "./WodniackPortfolioTemplate";
import { OdysseyPortfolioTemplate } from "./OdysseyPortfolioTemplate";

export function NavigatorPortfolioTemplate(props: EditorialPortfolioProps) {
  const variant = props.site.design?.templateVariant;

  if (variant === "editorial") {
    return <EditorialPortfolioTemplate {...props} />;
  }

  if (variant === "kinetic" || variant === "wodniack") {
    return <KineticPortfolioTemplate {...props} />;
  }

  if (variant === "odyssey") {
    return <OdysseyPortfolioTemplate {...props} />;
  }

  return <NavigatorPortfolioTemplateClassic {...props} />;
}
