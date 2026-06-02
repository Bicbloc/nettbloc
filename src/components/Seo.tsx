import { Helmet } from "react-helmet-async";

const BASE_URL = "https://nettobloc.bicbloc.eu";

interface SeoProps {
  title: string;
  description: string;
  path: string;
}

export const Seo = ({ title, description, path }: SeoProps) => {
  const url = `${BASE_URL}${path}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
    </Helmet>
  );
};

export default Seo;
