const { FuseV1Options, FuseVersion, flipFuses } = require('@electron/fuses');
const { join } = require('node:path');

const fuseFlags = {
  [FuseV1Options.RunAsNode]: false,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  [FuseV1Options.EnableNodeCliInspectArguments]: false,
  [FuseV1Options.EnableCookieEncryption]: true,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  [FuseV1Options.OnlyLoadAppFromAsar]: true,
};

const binaryPath = {
  darwin: (dir, name) => join(dir, `${name}.app`, 'Contents', 'MacOS', name),
  win32: (dir, name) => join(dir, `${name}.exe`),
  linux: (dir, name) => join(dir, name),
};

module.exports = async function afterPack(context) {
  const { appOutDir, electronPlatformName, packager } = context;
  const target = binaryPath[electronPlatformName](appOutDir, packager.appInfo.productFilename);

  await flipFuses(target, {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: electronPlatformName === 'darwin',
    ...fuseFlags,
  });
};
