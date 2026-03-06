import { execFileSync } from 'node:child_process';

const DRIVER = 'managementhtml';
const NAME_KEY = `merge.${DRIVER}.name`;
const DRIVER_KEY = `merge.${DRIVER}.driver`;
const args = new Set(process.argv.slice(2));

const runGit = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const readConfig = (key) => {
  try {
    return runGit(['config', '--local', '--get', key]);
  } catch {
    return '';
  }
};

const expectedName = 'Keep local dist/management.html during merges';
const expectedDriver = 'true';
const isConfigured = () => readConfig(NAME_KEY) === expectedName && readConfig(DRIVER_KEY) === expectedDriver;

if (args.has('--check')) {
  if (!isConfigured()) {
    console.error('management.html merge driver is not configured in local git config.');
    process.exit(1);
  }
  console.log('management.html merge driver is configured.');
  process.exit(0);
}

runGit(['config', '--local', NAME_KEY, expectedName]);
runGit(['config', '--local', DRIVER_KEY, expectedDriver]);
console.log('Configured local git merge driver for dist/management.html.');