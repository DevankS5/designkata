// Fails if any text file in the repo contains an em dash, an en dash,
// or something that looks like an API key. Runs in CI and before commits.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const binary = /\.(png|jpe?g|gif|ico|webp|pdf|woff2?|ttf)$/i;
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split('\n')
  .filter((file) => file && !binary.test(file) && file !== 'package-lock.json');

const checks = [
  { name: 'em dash', pattern: new RegExp(String.fromCodePoint(0x2014)) },
  { name: 'en dash', pattern: new RegExp(String.fromCodePoint(0x2013)) },
  { name: 'OpenRouter key', pattern: /sk-or-v1-[a-z0-9]{16,}/i },
];

let problems = 0;
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    for (const { name, pattern } of checks) {
      if (pattern.test(line)) {
        console.log(`${file}:${index + 1}: ${name}`);
        problems += 1;
      }
    }
  });
}

if (problems > 0) {
  console.error(`\ncheck-text: ${problems} problem(s). Use a hyphen, a colon or a new sentence instead of a dash.`);
  process.exit(1);
}
console.log(`check-text: ${files.length} files clean`);
