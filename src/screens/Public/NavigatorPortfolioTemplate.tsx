import {
  EditorialPortfolioTemplate,
  type EditorialPortfolioProps,
} from "./EditorialPortfolioTemplate";
import { HologramPortfolioTemplate } from "./HologramPortfolioTemplate";
import { NavigatorPortfolioTemplate as NavigatorPortfolioTemplateClassic } from "./NavigatorPortfolioTemplateClassic";
import { WodniackPortfolioTemplate as KineticPortfolioTemplate } from "./WodniackPortfolioTemplate";

export function NavigatorPortfolioTemplate(props: EditorialPortfolioProps) {
  const variant = props.site.design?.templateVariant;

  if (variant === "hologram" || variant === "atelier") {
    return <HologramPortfolioTemplate {...props} />;
  }

  if (variant === "editorial") {
    return <EditorialPortfolioTemplate {...props} />;
  }

  if (variant === "kinetic" || variant === "wodniack") {
    return <KineticPortfolioTemplate {...props} />;
  }

  return <NavigatorPortfolioTemplateClassic {...props} />;
}
