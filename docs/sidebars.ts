import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    'tech-stack',
    {
      type: 'category',
      label: 'Arquitectura',
      collapsed: false,
      items: [
        'architecture/overview',
        'architecture/offline',
        'architecture/sync-engine',
        'architecture/media-playback',
        'architecture/assets',
      ],
    },
    'api-reference',
    {
      type: 'category',
      label: 'Base de Datos',
      collapsed: false,
      items: [
        'database/overview',
        'database/erd',
      ],
    },
    'sync-protocol',
    'feature-matrix',
    {
      type: 'category',
      label: 'Testing',
      collapsed: true,
      items: [
        'testing/convergence',
        'testing/stress',
        'testing/consistency',
      ],
    },
    {
      type: 'category',
      label: 'Desarrollo',
      collapsed: true,
      items: [
        'development/architecture-rules',
        'development/invariants',
        'development/mutation-matrix',
        'development/ownership-matrix',
      ],
    },
  ],
};

export default sidebars;
