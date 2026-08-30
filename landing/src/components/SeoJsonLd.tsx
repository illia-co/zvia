import { SITE } from '../config'

const SOFTWARE_APPLICATION = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Zvia',
  applicationCategory: 'DeveloperApplication',
  applicationSubCategory: 'SSH client',
  operatingSystem: 'macOS, Windows, Linux',
  description: SITE.description,
  url: SITE.canonical,
  downloadUrl: SITE.canonical,
  softwareHelp: `${SITE.canonical}/documentation`,
  isAccessibleForFree: true,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD'
  },
  featureList: [
    'SSH and SFTP over standard connections',
    'Docker container management',
    'Nginx configuration and logs',
    'SSL certificate management',
    'systemd service control',
    'journal log streaming',
    'interactive terminal',
    'remote file browser'
  ]
}

export function SeoJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_APPLICATION) }}
    />
  )
}
