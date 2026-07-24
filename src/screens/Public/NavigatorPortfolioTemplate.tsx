import {
  EditorialPortfolioTemplate,
  type EditorialPortfolioProps,
} from "./EditorialPortfolioTemplate";
import { NavigatorPortfolioTemplate as NavigatorPortfolioTemplateClassic } from "./NavigatorPortfolioTemplateClassic";
import { WodniackPortfolioTemplate } from "./WodniackPortfolioTemplate";

export function NavigatorPortfolioTemplate(props: EditorialPortfolioProps) {
  if (props.site.design?.templateVariant === "editorial") {
    return <EditorialPortfolioTemplate {...props} />;
  }

  if (props.site.design?.templateVariant === "wodniack") {
    return <WodniackPortfolioTemplate {...props} />;
  }

  return <NavigatorPortfolioTemplateClassic {...props} />;
}
