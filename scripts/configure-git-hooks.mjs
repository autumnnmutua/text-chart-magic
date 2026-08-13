import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

if (!existsSync('.git')) {
  process.exit(0);
}

const run = (command, args, required = true) => {
  const result = spawnSync(command, args, {
    stdio: 'inherit'
  });

  if (required && (result.error || result.status !== 0)) {
    process.exit(result.status ?? 1);
  }
};

run(process.execPath, [resolve('node_modules/husky/bin.js')]);
run('git', ['config', 'blame.ignoreRevsFile', '.git-blame-ignore-revs'], false);
