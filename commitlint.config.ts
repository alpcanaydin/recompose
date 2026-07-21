export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'refactor',
        'perf',
        'docs',
        'test',
        'chore',
        'build',
        'ci',
        'style',
        'revert',
      ],
    ],
  },
};
