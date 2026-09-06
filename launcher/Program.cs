using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;

internal static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        try { new Application().Run(new LauncherWindow(args.Contains("--preview") || args.Contains("--smoke-test"), args.Contains("--smoke-test"))); }
        catch (Exception ex) { File.WriteAllText(Path.Combine(AppContext.BaseDirectory, "launcher-startup-error.log"), ex.ToString()); MessageBox.Show(ex.Message, "Aura Launcher"); }
    }
}
public partial class LauncherWindow : Window
{
    readonly string root = AppContext.BaseDirectory;
    readonly HttpClient http = new() { Timeout = TimeSpan.FromSeconds(60) };
    LauncherSettings settings = new();
    bool closing;
    int loops;
    readonly bool preview;
    public LauncherWindow(bool preview = false, bool smoke = false)
    {
        this.preview = preview;
        InitializeComponent();
        var logoPath = Path.Combine(root, "logo.png");
        if (File.Exists(logoPath)) Logo.Source = new BitmapImage(new Uri(logoPath));
        Video.MediaOpened += (_, _) => LogVideo("Opened: " + Video.NaturalVideoWidth + "x" + Video.NaturalVideoHeight);
        Video.MediaEnded += (_, _) => { loops++; Video.Position = TimeSpan.Zero; Video.Play(); LogVideo("Loop " + loops); };
        Video.MediaFailed += (_, e) => { LogVideo(e.ErrorException.ToString()); Video.Visibility = Visibility.Collapsed; MuteButton.IsEnabled = false; };
        Loaded += async (_, _) => {
            var path = Path.Combine(root, "launcher-bg.mp4");
            if (File.Exists(path)) { Video.Source = new Uri(path); Video.Play(); }
            if (preview) { status.Text = "Your realm is ready"; detail.Text = "Preview • video and interface in one layer"; if (smoke) _ = SmokeTest(); }
            else {
                await Sync();
                if (Environment.GetCommandLineArgs().Contains("--update-test")) {
                    Capture("update-test.png");
                    File.WriteAllText(Path.Combine(root, "update-test.json"),
                        JsonSerializer.Serialize(new { ready = play.IsEnabled, status = status.Text, detail = detail.Text }));
                    Close();
                }
            }
        };
        Closed += (_, _) => { closing = true; Video.Close(); http.CancelPendingRequests(); http.Dispose(); };
    }
    async Task SmokeTest()
    {
        await Task.Delay(5000);
        if (closing) return;
        Capture("wpf-preview-1.png");
        LogVideo("Position A: " + Video.Position);
        await Task.Delay(2000);
        if (closing) return;
        Capture("wpf-preview-2.png");
        LogVideo("Position B: " + Video.Position);
        MuteClick(this, new RoutedEventArgs());
        MuteClick(this, new RoutedEventArgs());
        if (Video.NaturalDuration.HasTimeSpan) Video.Position = Video.NaturalDuration.TimeSpan - TimeSpan.FromSeconds(1);
        await Task.Delay(4000);
        if (closing) return;
        LogVideo("Smoke result: loops=" + loops + "; muted=" + Video.IsMuted + "; UI=" + status.IsVisible + "; position=" + Video.Position);
        CloseClick(this, new RoutedEventArgs());
    }
    void Capture(string name)
    {
        var bitmap = new RenderTargetBitmap((int)ActualWidth, (int)ActualHeight, 96, 96, PixelFormats.Pbgra32);
        bitmap.Render(this);
        var encoder = new PngBitmapEncoder();
        encoder.Frames.Add(BitmapFrame.Create(bitmap));
        using var output = File.Create(Path.Combine(root, name));
        encoder.Save(output);
    }
    void LogVideo(string message) { try { File.AppendAllText(Path.Combine(root, "launcher-video.log"), DateTime.Now.ToString("O") + " " + message + Environment.NewLine); } catch { } }
    void CloseClick(object sender, RoutedEventArgs e) => Close();
    void MinimizeClick(object sender, RoutedEventArgs e) => WindowState = WindowState.Minimized;
    void MuteClick(object sender, RoutedEventArgs e) {
        Video.IsMuted = !Video.IsMuted; MuteButton.Content = Video.IsMuted ? "Sound off" : "Sound on";
        LogVideo("Muted: " + Video.IsMuted);
    }
    async void CheckClick(object sender, RoutedEventArgs e) => await Sync();
    void PlayClick(object sender, RoutedEventArgs e) => Launch();
    void DragWindow(object sender, MouseButtonEventArgs e) { if (e.OriginalSource == sender && e.LeftButton == MouseButtonState.Pressed) DragMove(); }
    async Task Sync()
    {
        retry.Visibility = Visibility.Collapsed; play.IsEnabled = false; progress.Value = 0; percent.Text = "0%";
        try
        {
            var cfg = Path.Combine(root, "launcher.json"); settings = File.Exists(cfg) ? JsonSerializer.Deserialize<LauncherSettings>(await File.ReadAllTextAsync(cfg), Opt.Default) ?? new() : new();
            settings.ManifestUrl = string.IsNullOrWhiteSpace(settings.ManifestUrl) ? "https://aurakingdom.online/updates/manifest.json" : settings.ManifestUrl;
            var manifest = JsonSerializer.Deserialize<Manifest>(await http.GetStringAsync(settings.ManifestUrl), Opt.Default) ?? throw new Exception("Manifest kosong"); version.Text = $"CLIENT {manifest.Version}";
            var changed = new List<ManifestFile>(); foreach (var f in manifest.Files ?? []) { status.Text = "Checking your client files"; detail.Text = f.Path; var local = Safe(f.Path); if (!File.Exists(local) || new FileInfo(local).Length != f.Size || !await Hash(local, f.Sha256)) changed.Add(f); }
            if (changed.Count == 0) { Ready("Your realm is ready", "No updates needed. Enter Aura Kingdom Online."); return; }
            status.Text = "A new chapter awaits"; detail.Text = $"Downloading {changed.Count} updated file(s)..."; var baseUri = new Uri(manifest.BaseUrl ?? new Uri(settings.ManifestUrl).GetLeftPart(UriPartial.Authority) + "/"); long done = 0, total = changed.Sum(x => x.Size);
            foreach (var f in changed) { var target = Safe(f.Path); Directory.CreateDirectory(Path.GetDirectoryName(target)!); await Download(new Uri(baseUri, f.Path), target, f.Size, f.Sha256, n => { var v = total == 0 ? 100 : (int)Math.Clamp((done + n) * 100 / total, 0, 100); progress.Value = v; percent.Text = $"{v}%"; detail.Text = f.Path; });  done += f.Size; }
            Ready("Update complete", "Your client is synchronized with the latest realm.");
        }
        catch (Exception ex) { status.Text = "Update unavailable"; detail.Text = ex.Message; retry.Visibility = Visibility.Visible; }
    }
    string Safe(string rel) { var p = Path.GetFullPath(Path.Combine(root, rel.Replace('/', Path.DirectorySeparatorChar))); if (!p.StartsWith(root, StringComparison.OrdinalIgnoreCase)) throw new Exception("Manifest path tidak valid"); return p; }
    async Task<bool> Hash(string p, string expected) { await using var s = File.OpenRead(p); return Convert.ToHexString(await SHA256.HashDataAsync(s)).Equals(expected, StringComparison.OrdinalIgnoreCase); }
    async Task Download(Uri url, string target, long expected, string expectedHash, Action<long> report)
    { var temp = target + ".download"; long have = File.Exists(temp) ? new FileInfo(temp).Length : 0; using var req = new HttpRequestMessage(HttpMethod.Get, url); if (have > 0) req.Headers.Range = new RangeHeaderValue(have, null); using var res = await http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead); if (have > 0 && res.StatusCode == HttpStatusCode.OK) { File.Delete(temp); have = 0; } res.EnsureSuccessStatusCode(); await using var input = await res.Content.ReadAsStreamAsync(); await using var output = new FileStream(temp, have > 0 ? FileMode.Append : FileMode.Create, FileAccess.Write, FileShare.None, 1024 * 1024, true); var b = new byte[1024 * 1024]; long n = have; int r; while ((r = await input.ReadAsync(b)) > 0) { await output.WriteAsync(b.AsMemory(0, r)); n += r; report(n); } if (expected > 0 && n != expected) throw new Exception("Download tidak lengkap"); output.Close(); if (!await Hash(temp, expectedHash)) { File.Delete(temp); throw new Exception("Checksum gagal; coba lagi."); } File.Move(temp, target, true); }
    void Ready(string a, string b) { status.Text = a; detail.Text = b; progress.Value = 100; percent.Text = "100%"; play.IsEnabled = true; play.Focus(); }
    void Launch() { var p = Path.Combine(root, settings.GameExecutable); if (File.Exists(p)) Process.Start(new ProcessStartInfo(p) { WorkingDirectory = root, UseShellExecute = true }); else detail.Text = "GameLauncher.exe tidak ditemukan."; }
}
sealed class LauncherSettings { public string ManifestUrl { get; set; } = ""; public string GameExecutable { get; set; } = "GameLauncher.exe"; }
sealed class Manifest { public string Version { get; set; } = ""; public string? BaseUrl { get; set; } public List<ManifestFile>? Files { get; set; } }
sealed class ManifestFile { public string Path { get; set; } = ""; public long Size { get; set; } public string Sha256 { get; set; } = ""; }
static class Opt { public static readonly JsonSerializerOptions Default = new() { PropertyNameCaseInsensitive = true }; }
