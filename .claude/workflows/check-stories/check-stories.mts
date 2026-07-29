import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const uiComponent = /^apps\/desktop\/src\/renderer\/src\/.*\/ui\/[^/]+\.tsx$/u;
const notItself = /\.(stories|test|browser\.test)\.tsx$/u;

function addedFilesSince(base: string): readonly string[] {
  const diff = execFileSync('git', ['diff', '--name-only', '--diff-filter=A', `${base}...HEAD`], {
    encoding: 'utf8',
  });

  return diff.split('\n').filter((line) => line.length > 0);
}

function lacksStory(file: string): boolean {
  if (!uiComponent.test(file) || notItself.test(file)) {
    return false;
  }

  return !existsSync(file.replace(/\.tsx$/u, '.stories.tsx'));
}

function storylessComponents(base: string): readonly string[] {
  return addedFilesSince(base).filter(lacksStory);
}

const missingStories = 3;

const base = process.argv[2] ?? 'origin/main';
const storyless = storylessComponents(base);

if (storyless.length > 0) {
  console.error(
    `every renderer ui component ships a stories sibling, and these do not:\n${storyless
      .map((file) => `  ${file}`)
      .join(
        '\n',
      )}\n\nWrite the story, or take the pull-request escape: the stories-exempt label plus a 'Stories-exempt: <reason>' line in the body.`,
  );
  process.exit(missingStories);
}

console.log(`every renderer ui component added since ${base} ships a stories sibling`);
