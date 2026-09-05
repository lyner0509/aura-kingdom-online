Aura Kingdom Online Launcher 4.0.0 - WPF

Extract all files beside GameLauncher.exe in the game folder.
Run AuraLauncher.exe. No console or title bar is displayed.

Video, transparent logo, text and buttons use the same WPF visual surface.
Sound starts muted. Use Sound off / Sound on to toggle audio.
Video repeats automatically. The top-right X closes the launcher.

This version uses Windows WPF MediaElement. The old libvlc folder is not used.
If playback fails, the interface remains available on a static background.
Video diagnostics: launcher-video.log beside the executable.

The update server is configured in launcher.json. Play is enabled only after
update verification succeeds. Hosting the manifest/files is a separate step.

Developer preview: AuraLauncher.exe --preview
Playback smoke test: AuraLauncher.exe --smoke-test
Smoke test creates two screenshots and a playback log, tests looping/mute,
then closes the test window. It does not update or launch the game.
