# Native mobile app (Capacitor)

The core site is still the flat collection of static HTML files described in
`CLAUDE.md` — there is no bundler and no change to how those pages work in a
browser. This adds a thin [Capacitor](https://capacitorjs.com) shell so the
same pages can be packaged as an installable Android/iOS app instead of only
being viewable in a mobile browser.

## Production web deploy is unaffected

The live site is deployed to Vercel as a plain static site. Adding
`package.json` here would otherwise make Vercel auto-detect a Node.js build
(running `npm install` + this project's `build` script, whose output is
`www/`, not what the static site expects). `vercel.json` explicitly disables
the install/build steps and keeps the repo root as the output directory, so
the production deploy keeps working exactly as before — this Capacitor setup
only matters when you run the `npm`/`npx cap` commands yourself.

## Layout

- `package.json`, `capacitor.config.json` — Capacitor project config. App id
  `com.easyadpromotion.app`, app name "Easy Ad Promotion".
- `scripts/build-www.mjs` — copies the root-level `*.html`, `i18n.js`, and
  image assets into `www/` (Capacitor's `webDir`). SQL migration files and
  repo tooling are intentionally excluded. `www/` is generated, not
  version-controlled.
- `android/`, `ios/` — the native platform projects Capacitor generated
  (`npx cap add android|ios`). These *are* version-controlled, since they're
  where native-only config (permissions, signing, splash/launch screen
  tweaks) lives going forward.
- `resources/icon.png` (1024x1024) and `resources/splash.png` (2732x2732) —
  source images for app icon/splash, generated from `EAP-LOGO.jpg` padded
  onto the app's brand blue (`#29b6f6`). Re-run asset generation any time the
  logo changes.

## Building

Requires Node.js. Building the actual native binaries additionally requires
Android Studio (Android SDK) and/or Xcode (iOS, macOS only) — neither is
installed in this environment, so this repo only prepares the native
projects; a full `.apk`/`.ipa` build needs to happen on a machine with those
installed.

```bash
npm install               # Capacitor deps

npm run build              # assemble www/ from the current HTML pages
npx cap sync                # copy www/ + config into android/ and ios/

npm run cap:open:android   # opens android/ in Android Studio
npm run cap:open:ios       # opens ios/App/App.xcworkspace in Xcode
```

Run `npm run cap:sync` (build + sync in one step) any time the HTML pages,
`i18n.js`, or the logo change and you want the native projects to pick it up.

## Regenerating icons/splash screens

If `EAP-LOGO.jpg` changes, regenerate `resources/icon.png` and
`resources/splash.png` (square, brand-blue background) from it, then run:

```bash
npx capacitor-assets generate
npx cap sync
```

## Known limitations to revisit

- The HTML pages are styled as a fixed-width (`max-width: 340px`) "phone
  mockup" meant to be centered in a desktop browser, complete with an outer
  bezel/shadow (`.mobile-screen` + `@media (min-width: 450px)` in most
  pages). Inside the native WebView this mockup styling is no longer needed
  — real devices are often wider than 340 logical px, so pages currently
  render with visible side padding/background instead of filling the
  screen. Adapting the shared page chrome to go edge-to-edge when running
  inside Capacitor (e.g. via `Capacitor.isNativePlatform()`) is a follow-up,
  not part of this scaffold.
- Auth/session handling (`localStorage`-based per `CLAUDE.md`) is unchanged;
  it works the same inside the WebView as in a mobile browser.
- No native plugins (push notifications, camera, etc.) are wired up — this
  only wraps the existing web pages.
