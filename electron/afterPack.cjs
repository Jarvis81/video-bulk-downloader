// electron-builder afterPack hook: flip Electron security fuses on the packaged
// binary to deter inspection / tampering.
//
//  - RunAsNode / NodeOptions / NodeCliInspect OFF → the binary can't be relaunched
//    as a plain Node process (a common way to dump or step through an Electron app).
//  - OnlyLoadAppFromAsar ON → Electron only runs the app from app.asar; a swapped-in
//    folder or renamed app won't load. (This is the safe part of "asar integrity".)
//  - EnableCookieEncryption ON → Chromium's cookie store is encrypted at rest.
//
// Cryptographic asar-hash validation (EnableEmbeddedAsarIntegrityValidation) is
// intentionally NOT set: it needs the build tool to inject the asar hash into the
// binary (electron-builder 26+ / electronFuses), and turning it on without that
// would brick the app. Failures here are warned, not fatal, so the build still
// produces a working exe.
const path = require("node:path");

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;
  try {
    const { flipFuses, FuseVersion, FuseV1Options } = await import("@electron/fuses");
    const exe = path.join(
      context.appOutDir,
      `${context.packager.appInfo.productFilename}.exe`,
    );
    await flipFuses(exe, {
      version: FuseVersion.V1,
      resetAdHocDarwinSignature: false,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    });
    console.log("  ✓ applied Electron security fuses");
  } catch (err) {
    console.warn("  ⚠ could not apply Electron fuses (continuing):", err.message);
  }
};
