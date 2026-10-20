/** Layer rules: domain ← application ← infra/engine ← presentation (ui, scenes, stages). */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      severity: 'error',
      comment: 'domain may import only domain code (no npm packages, no DOM libs).',
      from: { path: '^src/domain' },
      to: { pathNot: '^src/domain' },
    },
    {
      name: 'application-only-domain',
      severity: 'error',
      comment: 'application may import only domain and application (zustand vanilla allowed).',
      from: { path: '^src/application' },
      to: { pathNot: ['^src/(domain|application)', 'node_modules/zustand/'] },
    },
    {
      name: 'no-react-in-application',
      severity: 'error',
      from: { path: '^src/application' },
      to: { path: 'node_modules/zustand/(esm/)?react' },
    },
    {
      name: 'infra-no-presentation',
      severity: 'error',
      comment: 'infra/engine must not depend on UI, scenes or stages.',
      from: { path: '^src/(infra|engine)' },
      to: { path: '^src/(ui|scenes|stages|app)' },
    },
    {
      name: 'stages-isolated',
      severity: 'error',
      comment: 'Stage plugins never import each other (shared code lives in engine/ or stages/_shared).',
      from: { path: '^src/stages/([^/_][^/]*)/' },
      to: { path: '^src/stages/([^/_][^/]*)/', pathNot: '^src/stages/$1/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
  },
};
