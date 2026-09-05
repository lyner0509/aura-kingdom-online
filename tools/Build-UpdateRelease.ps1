param([string]$Version='2026.09.06.1', [string[]]$AdditionalFiles=@())
$ErrorActionPreference='Stop'
if ($Version -notmatch '^[0-9.]+$') { throw 'Invalid version' }
$workspace=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$client=Join-Path $workspace 'client'
$stage=Join-Path $workspace "_release/update-$Version"
$filesRoot=Join-Path $stage 'files'
New-Item -ItemType Directory -Force -Path $filesRoot | Out-Null
# Explicit managed scope: never include personal client.ini/User.ini or private folders.
foreach($name in @('game.bin','GameLauncher.exe')) {
 Copy-Item -LiteralPath (Join-Path $client $name) -Destination $filesRoot -Force
}
[IO.File]::WriteAllText((Join-Path $filesRoot 'connect.ini'), "Server=43.157.225.131,6543`r`n", [Text.Encoding]::ASCII)
[IO.File]::WriteAllText((Join-Path $filesRoot 'Banner.ini'), "Banner  https://aurakingdom.online/`r`nNote  https://aurakingdom.online/`r`n", [Text.Encoding]::ASCII)
foreach ($relative in $AdditionalFiles) {
 $source=[IO.Path]::GetFullPath((Join-Path $client $relative))
 if (-not $source.StartsWith($client+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Path outside client' }
 if ($relative -match '(?i)(^|[/\\])(Temp|UserSetting|ScreenCapture|client.ini|User.ini|launcher.json|AuraLauncher.exe)([/\\]|$)|\.(log|bak|rpl)$') { throw "Private/runtime file excluded: $relative" }
 $destination=[IO.Path]::GetFullPath((Join-Path $filesRoot $relative))
 if (-not $destination.StartsWith($filesRoot+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid destination' }
 New-Item -ItemType Directory -Force -Path ([IO.Path]::GetDirectoryName($destination)) | Out-Null
 Copy-Item -LiteralPath $source -Destination $destination -Force
}
$files=@(Get-ChildItem -LiteralPath $filesRoot -File -Recurse | ForEach-Object {
 [ordered]@{path=$_.FullName.Substring($filesRoot.Length+1).Replace('\','/');size=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName).Hash.ToLowerInvariant()}
})
$manifest=[ordered]@{
 version=$Version
 baseUrl="https://aurakingdom.online/updates/releases/$Version/files/"
 files=$files
}
[IO.File]::WriteAllText((Join-Path $stage 'manifest.json'), ($manifest | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
Get-Item -LiteralPath $stage | Select-Object FullName
