<p align="center">
  <img src="docs/icon.png" width="160" alt="StillLife icon: a hand-drawn lavender Saturn">
</p>

<h1 align="center">StillLife</h1>
<p align="center"><em>Every note, quietly in orbit.</em></p>

<p align="center">
  <a href="https://github.com/BellaCYC/Still-Life/releases/latest/download/StillLife-Setup.exe"><strong>⬇ Download for Windows</strong></a>
  ·
  <a href="https://bellacyc.github.io/Still-Life/">Download page</a>
</p>

---

## Install

1. Click **Download for Windows** above.
2. Double-click **StillLife-Setup.exe**.
3. If Windows shows **"Windows protected your PC"**, click **More info → Run anyway**. This is normal for new apps.

## Status

StillLife is an early preview. This first version only opens the StillLife window; notebooks, docs, agendas and the top-edge island are being built next.

## For developers

Built with [Tauri 2](https://tauri.app).

```bash
npm install
npm run dev     # run the app locally
npm run build   # build the Windows installer
```

### Releasing a new version

1. Change `version` in `src-tauri/tauri.conf.json` (and in `package.json` and `src-tauri/Cargo.toml`).
2. Go to **Actions → Release → Run workflow**.
3. A few minutes later the new installer appears under **Releases**, and the download button gives it to everyone automatically.
