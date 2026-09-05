# Source of truth

Edit this checkout, commit, and push main.
GitHub Actions verifies and deploys the landing page/news API and dashboard.
The deployed SHA is available at /deployed-revision.txt.
Only staged public web files reach the web root; dashboard and launcher source stay out.

Windows launcher changes produce an Actions artifact with the executable and video.
The pinned baseline package supplies the video asset; game assets and secrets are not in Git.
Publishing a launcher artifact as the public download is a separate release operation.
Client patch releases remain explicit, versioned uploads documented in tools/UPDATE-RELEASE.md.

The sibling landing-page, aura-dashboard and launcher directories are previous working copies.
For subsequent changes use this repository's root, dashboard/ and launcher/.
