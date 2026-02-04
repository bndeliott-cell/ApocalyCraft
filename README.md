# ApocalyCraft Launcher

Custom launcher for ApocalyCraft servers. All mods, configurations, and updates are handled automatically.

## AppImage Verification

Import the public key and verify the AppImage signature:

```bash
gpg --import apocalycraft-launcher-public-key.asc
gpg --verify ApocalyCraft-Launcher-<VERSION>-x86_64.AppImage.sig ApocalyCraft-Launcher-<VERSION>-x86_64.AppImage
```

Verify the SHA256 checksum:

```bash
sha256sum -c ApocalyCraft-Launcher-<VERSION>-x86_64.AppImage.sha256
```

Public key (download):
`https://apocalycraft.fr/handle-download/apocalycraft-launcher-public-key.asc`

## Release usage

Create a signed tag and push it:

```bash
./scripts/sign-release-tag.sh
git push origin vX.Y.Z
```
