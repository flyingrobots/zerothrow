/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  // Main documentation sidebar
  docs: [
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'introduction',
        'installation',
        'quickstart',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api/README',
        'api/core-types',
        'api/core-functions',
        'api/combinators',
        'api/react',
        'api/eslint',
        'api/type-utilities',
      ],
    },
    {
      type: 'category',
      label: 'Tutorials',
      items: [
        'tutorials/01-getting-started',
        'tutorials/02-advanced-patterns',
        'tutorials/03-error-handling',
        'tutorials/04-functional-programming',
      ],
    },
    {
      type: 'category',
      label: 'Examples',
      items: [
        'examples/README',
        'examples/interactive-playground',
        'examples/express-api',
        'examples/file-processor',
        'examples/react-form',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/migration-guide',
        'guides/performance',
        'guides/best-practices',
        'guides/githooks',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'contributing',
        'license',
        'changelog',
      ],
    },
  ],

  // Separate sidebar for API docs if needed
  api: [
    {
      type: 'doc',
      id: 'api/README',
      label: 'Overview',
    },
    {
      type: 'category',
      label: 'Core',
      collapsed: false,
      items: [
        'api/core-types',
        'api/core-functions',
      ],
    },
    {
      type: 'category',
      label: 'Advanced',
      items: [
        'api/combinators',
        'api/type-utilities',
      ],
    },
    {
      type: 'category',
      label: 'Integrations',
      items: [
        'api/react',
        'api/eslint',
      ],
    },
  ],
};

module.exports = sidebars;