const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

function findGitHubRepo() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    const repo = pkg.repository && pkg.repository.url;
    if (!repo) return null;
    const match = repo.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/i);
    if (!match) return null;
    return { owner: match[1], repo: match[2] };
  } catch {
    return null;
  }
}

function resolveAppImageTool() {
  const localPath = path.join(__dirname, '..', 'tools', 'appimagetool');
  if (fs.existsSync(localPath)) {
    return localPath;
  }
  return 'appimagetool';
}

function requireAppImageTool(appImageToolPath) {
  try {
    execFileSync(appImageToolPath, ['--help'], { stdio: 'ignore' });
  } catch (error) {
    throw new Error(
      'appimagetool introuvable. Place une copie exécutable dans tools/appimagetool ou installe appimagetool dans le PATH.'
    );
  }
}

function buildUpdateInfo(artifactName) {
  const repoInfo = findGitHubRepo() || { owner: 'ApocalyCraft', repo: 'ApocalyCraft' };
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const version = pkg.version;
  const pattern = artifactName.replace(version, '*');
  const zsync = `${pattern}.zsync`;
  return {
    updateInfo: `gh-releases-zsync|${repoInfo.owner}|${repoInfo.repo}|latest|${zsync}`,
    zsync,
  };
}

function listAppImages(distDir) {
  if (!fs.existsSync(distDir)) return [];
  return fs
    .readdirSync(distDir)
    .filter((file) => file.endsWith('.AppImage'))
    .map((file) => path.join(distDir, file));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function extractAppImage(appImagePath, workDir) {
  execFileSync(appImagePath, ['--appimage-extract'], { cwd: workDir, stdio: 'inherit' });
  return path.join(workDir, 'squashfs-root');
}

function ensureDesktopInApplications(appDir, desiredDesktopFile) {
  const desktopFiles = fs.readdirSync(appDir).filter((file) => file.endsWith('.desktop'));
  if (desktopFiles.length === 0) return;
  let desktopFileName = desktopFiles[0];
  const source = path.join(appDir, desktopFileName);
  let finalSource = source;

  if (desiredDesktopFile && desktopFileName !== desiredDesktopFile) {
    const renamed = path.join(appDir, desiredDesktopFile);
    fs.renameSync(source, renamed);
    desktopFileName = desiredDesktopFile;
    finalSource = renamed;
  }

  const targetDir = path.join(appDir, 'usr', 'share', 'applications');
  fs.mkdirSync(targetDir, { recursive: true });
  const target = path.join(targetDir, desktopFileName);
  fs.copyFileSync(finalSource, target);
}

function runAppImageLint(appDir) {
  const lintScript = path.join(__dirname, 'appimage-lint.sh');
  if (!fs.existsSync(lintScript)) return;
  execFileSync('bash', [lintScript, appDir], { stdio: 'inherit' });
}

function repackAppImage(appImageToolPath, appDir, outputPath, updateInfo, cwd, noAppStream) {
  const args = ['-u', updateInfo];
  if (noAppStream) {
    args.push('--no-appstream');
  }
  args.push(appDir, outputPath);

  execFileSync(appImageToolPath, args, {
    stdio: 'inherit',
    cwd,
  });
}

function signAppImage(appImageToolPath, appImagePath, cwd) {
  const signEnabled = String(process.env.APPIMAGE_SIGN || '').toLowerCase() === '1'
    || String(process.env.APPIMAGE_SIGN || '').toLowerCase() === 'true';
  if (!signEnabled) return;

  const keyId = process.env.APPIMAGE_GPG_KEYID;
  try {
    const args = ['--sign'];
    if (keyId) {
      args.push('--sign-key', keyId);
    }
    args.push(appImagePath);

    execFileSync(appImageToolPath, args, {
      stdio: 'inherit',
      cwd,
    });
    return;
  } catch (error) {
    // Fallback to detached GPG signature if appimagetool --sign is unsupported.
    const sigPath = `${appImagePath}.sig`;
    const gpgArgs = ['--detach-sign', '--output', sigPath];
    if (keyId) {
      gpgArgs.push('-u', keyId);
    }
    gpgArgs.push(appImagePath);

    execFileSync('gpg', gpgArgs, { stdio: 'inherit', cwd });
  }
}

function writeSha256(appImagePath, distDir) {
  const { createHash } = require('crypto');
  const data = fs.readFileSync(appImagePath);
  const hash = createHash('sha256').update(data).digest('hex');
  const fileName = `${path.basename(appImagePath)}.sha256`;
  const outPath = path.join(distDir, fileName);
  fs.writeFileSync(outPath, `${hash}  ${path.basename(appImagePath)}\n`);
}

exports.default = async function afterAllArtifactBuild(context) {
  if (process.platform !== 'linux') return [];

  const distDir = context && context.outDir ? context.outDir : path.join(__dirname, '..', 'dist');
  const appImages = listAppImages(distDir);
  if (appImages.length === 0) return [];

  const appImageToolPath = resolveAppImageTool();
  requireAppImageTool(appImageToolPath);

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'appimage-update-'));
  const generated = [];

  for (const appImagePath of appImages) {
    const artifactName = path.basename(appImagePath);
    const { updateInfo, zsync } = buildUpdateInfo(artifactName);

    const workDir = path.join(tempRoot, path.basename(artifactName, '.AppImage'));
    ensureDir(workDir);

    const appDir = extractAppImage(appImagePath, workDir);
    ensureDesktopInApplications(appDir, 'fr.apocalycraft.launcher.desktop');
    runAppImageLint(appDir);
    const outputPath = appImagePath;

    const noAppStream = String(process.env.APPIMAGE_NO_APPSTREAM || '').toLowerCase() === '1'
      || String(process.env.APPIMAGE_NO_APPSTREAM || '').toLowerCase() === 'true'
      || String(process.env.APPIMAGE_SKIP_APPSTREAM || '').toLowerCase() === '1'
      || String(process.env.APPIMAGE_SKIP_APPSTREAM || '').toLowerCase() === 'true';

    repackAppImage(appImageToolPath, appDir, outputPath, updateInfo, distDir, noAppStream);
    signAppImage(appImageToolPath, outputPath, distDir);
    writeSha256(outputPath, distDir);

    const zsyncPath = path.join(distDir, zsync);
    if (!fs.existsSync(zsyncPath)) {
      const tempZsync = path.join(workDir, zsync);
      if (fs.existsSync(tempZsync)) {
        fs.renameSync(tempZsync, zsyncPath);
      }
    }

    if (fs.existsSync(zsyncPath)) {
      generated.push(zsyncPath);
    }
  }

  return generated;
};
