import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Threshold',
  tagline: 'Documentación técnica completa de Threshold',
  favicon: 'img/favicon.ico',

  url: 'https://threshold-docs.example.com',
  baseUrl: '/',

  organizationName: 'Threshold',
  projectName: 'threshold-docs',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'es',
    locales: ['es'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Threshold Docs',
      logo: {
        alt: 'Threshold Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Documentación',
        },
        {
          href: 'https://github.com/Oponobono/threshold',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentación',
          items: [
            { label: 'Introducción', to: '/intro' },
            { label: 'Tech Stack', to: '/tech-stack' },
            { label: 'Sync Protocol', to: '/sync-protocol' },
          ],
        },
        {
          title: 'Arquitectura',
          items: [
            { label: 'General', to: '/architecture/overview' },
            { label: 'Offline', to: '/architecture/offline' },
            { label: 'Sync Engine', to: '/architecture/sync-engine' },
          ],
        },
        {
          title: 'Más',
          items: [
            { label: 'API Reference', to: '/api-reference' },
            { label: 'Database', to: '/database/overview' },
            { label: 'GitHub', href: 'https://github.com/Oponobono/threshold' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Threshold.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'sql', 'typescript', 'mermaid'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
