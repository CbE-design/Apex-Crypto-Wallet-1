import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://apexwallet.app/login', priority: 1.0 },
    { url: 'https://apexwallet.app/coming-soon', priority: 0.5 },
    { url: 'https://apexwallet.app/legal/terms', priority: 0.8 },
    { url: 'https://apexwallet.app/legal/privacy', priority: 0.8 },
    { url: 'https://apexwallet.app/legal/risk-disclosure', priority: 0.7 },
    { url: 'https://apexwallet.app/legal/aml-policy', priority: 0.7 },
  ];
}
