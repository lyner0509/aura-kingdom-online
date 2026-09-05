# Live updater

Manifest: https://aurakingdom.online/updates/manifest.json
Storage: /var/www/aura-updates/releases on the existing VPS.

Release 2026.09.06.1 manages game.bin, GameLauncher.exe, connect.ini and Banner.ini.
Players must first extract the full client and then the latest WPF launcher into
the same folder. This initial patch does not install or repair all game assets.

Build a new uniquely versioned release:

    powershell -File tools/Build-UpdateRelease.ps1 -Version 2026.09.07.1

For content updates, invoke from PowerShell and pass explicit paths:

    & ./tools/Build-UpdateRelease.ps1 -Version 2026.09.07.1 -AdditionalFiles @('data/example.dat')

Include ALL previously managed content files in each new manifest, plus the changed
ones, so players skipping versions receive all required patches. Personal settings,
screenshots and logs must not be published. Inspect the manifest before publishing.
Do not modify an already published release directory: immutable caching is enabled.

Upload the complete new release into a staging directory using SCP. As server admin,
verify every staged file's size and SHA256 against its manifest, then copy it into
/var/www/aura-updates/releases/VERSION. Publish the new manifest only after all files
are available: copy it to /var/www/aura-updates/manifest.json.pending then rename
that file to manifest.json. Keep previous release directories for rollback.

Rollback: atomically replace the active manifest with a previous release manifest.
No nginx reload is needed for publishing a manifest.

Launcher testing: --update-test downloads/verifies the active patch and writes
update-test.json and a screenshot, then closes without starting the game.
Use an isolated test folder for that command.

Launcher self-update, delta patches, account registration, full-client download
hosting, and end-to-end game login are not implemented by this initial patch.
