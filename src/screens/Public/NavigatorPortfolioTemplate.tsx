import {
  EditorialPortfolioTemplate,
  type EditorialPortfolioProps,
} from "./EditorialPortfolioTemplate";
import { NavigatorPortfolioTemplate as NavigatorPortfolioTemplateClassic } from "./NavigatorPortfolioTemplateClassic";

export function NavigatorPortfolioTemplate(props: EditorialPortfolioProps) {
  if (props.site.design?.templateVariant === "editorial") {
    return <EditorialPortfolioTemplate {...props} />;
  }

  return <NavigatorPortfolioTemplateClassic {...props} />;
}
