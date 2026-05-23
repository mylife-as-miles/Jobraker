import React from "react";
import { Helmet } from "react-helmet-async";

const APP_ORIGIN = "https://app.jobraker.io";
const DEFAULT_OG_IMAGE = `${APP_ORIGIN}/logo/logo.jpeg`;

type SeoProps = {
  title: string;
  description: string;
  path?: string;
  image?: string;
  noindex?: boolean;
};

export function Seo({
  title,
  description,
  path = "/",
  image = DEFAULT_OG_IMAGE,
  noindex = false,
}: SeoProps) {
  const canonicalUrl = new URL(path, APP_ORIGIN).toString();

  return (
    <Helmet>
      <title>{title}</title>
      <meta name='description' content={description} />
      <meta property='og:title' content={title} />
      <meta property='og:description' content={description} />
      <meta property='og:type' content='website' />
      <meta property='og:url' content={canonicalUrl} />
      <meta property='og:image' content={image} />
      <meta name='twitter:card' content='summary_large_image' />
      <meta name='twitter:title' content={title} />
      <meta name='twitter:description' content={description} />
      <meta name='twitter:image' content={image} />
      <link rel='canonical' href={canonicalUrl} />
      {noindex ? <meta name='robots' content='noindex,nofollow' /> : null}
    </Helmet>
  );
}

export default Seo;
