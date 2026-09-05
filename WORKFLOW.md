# Source of truth

Edit this checkout, commit, and push main.
GitHub Actions verifies and deploys the landing page/news API and dashboard.
The deployed SHA is available at /revision.txt.
Only staged public web files reach the web root; dashboard and launcher source stay out.

Windows launcher changes produce an Actions artifact with the executable and video.
The pinned baseline package supplies the video asset; game assets and secrets are not in Git.
The launcher workflow also uploads the artifact to the VPS and replaces the public
/updates/launcher.zip download. The landing page uses this stable link.
Client patch releases remain explicit, versioned uploads documented in tools/UPDATE-RELEASE.md.

The sibling landing-page, aura-dashboard and launcher directories are previous working copies.
For subsequent changes use this repository's root, dashboard/ and launcher/.
