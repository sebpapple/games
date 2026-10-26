import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const isWindows = process.platform === 'win32';
const variant = process.argv[2] ?? 'debug';
if (!['debug', 'release'].includes(variant)) {
  throw new Error(`Unsupported Android build variant: ${variant}`);
}

if (variant === 'release') {
  const requiredVariables = [
    'ANDROID_RELEASE_STORE_FILE',
    'ANDROID_RELEASE_STORE_PASSWORD',
    'ANDROID_RELEASE_KEY_ALIAS',
    'ANDROID_RELEASE_KEY_PASSWORD',
  ];
  const missingVariables = requiredVariables.filter((name) => !process.env[name]);
  if (missingVariables.length > 0) {
    throw new Error(
      `Missing release signing environment variables: ${missingVariables.join(', ')}`,
    );
  }
  const storeFile = resolve(process.env.ANDROID_RELEASE_STORE_FILE);
  if (!existsSync(storeFile)) {
    throw new Error(
      `Release keystore not found: ${storeFile}`,
    );
  }
  process.env.ANDROID_RELEASE_STORE_FILE = storeFile;
}

const command = isWindows ? 'cmd.exe' : './gradlew';
const args = isWindows
  ? ['/d', '/s', '/c', `gradlew.bat assemble${variant[0].toUpperCase()}${variant.slice(1)}`]
  : [`assemble${variant[0].toUpperCase()}${variant.slice(1)}`];

const result = spawnSync(command, args, {
  cwd: new URL('../android/', import.meta.url),
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
