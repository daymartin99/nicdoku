# Nicdoku for iPhone + Apple Watch

The same game as nicdoku.vercel.app, wrapped as a native iPhone app (Capacitor), plus an
Apple Watch app for Power Hour: clock and combo on the wrist, taps before spins and at TIME.,
live heart rate graphed on the results, breaks saved to Apple Health as Mindful Minutes,
and a watch-face complication (break open / next break / resting, and her week).

Everything is generated from this folder; you never hand-edit an Xcode project.

```
native/
  project.yml            Xcode project definition (XcodeGen)
  Config.xcconfig        Team ID, bundle ID prefix, version  ← edit TEAM_ID once
  App/                   iPhone: app shell, Swift plugin, Health, Watch link
  Watch/                 Apple Watch app (SwiftUI)
  Complication/          watch-face complication (WidgetKit)
  Shared/                status shared by Watch app + complication
  scripts/setup-mac.sh   one-time Mac setup (no admin needed)
  scripts/prepare.sh     web build → copy into app → generate Xcode project
```

---

## First time, on a rented Mac (MacinCloud)

**Pick a plan that has the latest Xcode (26.x).** Any plan works; no admin rights needed.

### 1. Get the code
Open **Terminal** on the Mac:
```bash
git clone https://github.com/daymartin99/nicdoku.git
cd nicdoku
```
(GitHub will ask you to sign in; use a personal access token as the password, or `gh auth login` if the GitHub CLI is there.)

### 2. Set your Team ID
Find it at developer.apple.com → Account → **Membership details → Team ID** (10 characters).
```bash
sed -i '' 's/YOUR_TEAM_ID/ABCDE12345/' native/Config.xcconfig   # ← your ID
```

### 3. Set up and generate the project
```bash
./native/scripts/setup-mac.sh
```
It installs Node.js and XcodeGen into your home folder, builds the game and creates
`native/Nicdoku.xcodeproj`. Takes a few minutes the first time.

### 4. Open it in Xcode
```bash
open native/Nicdoku.xcodeproj
```
- Xcode → **Settings → Accounts** → add the Apple ID for the developer account.
- Wait for "Resolving package graph" (Capacitor) to finish at the top of the window.
- Click the **Nicdoku** project → each target → **Signing & Capabilities**: the team should
  already be filled in and "Automatically manage signing" ticked. Xcode registers the app IDs,
  HealthKit and the App Group for you on first build.

### 5. Try it in the simulators
- Top bar: scheme **Nicdoku**, destination an **iPhone 17** simulator → ▶ Run.
  Play a break; open Power Hour.
- For the Watch: scheme **NicdokuWatch**, destination the Apple Watch simulator paired with that
  iPhone → ▶ Run. Start Power Hour on the phone simulator: the Watch should switch to the
  countdown. The Watch simulator produces **simulated** heart rate during the session.
- Tip: to test Power Hour quickly, in the phone simulator's web inspector (Safari → Develop →
  Simulator) run `localStorage.setItem('nd:debugPowerScale','60')` and reload: the hour lasts 1 minute.
  Remove it afterwards.

### 6. Create the app in App Store Connect (once)
appstoreconnect.apple.com → **Apps → + → New App**
- Platform **iOS**, Name **Nicdoku** (if taken, anything, e.g. "Nicdoku Puzzles"; it's private),
  Language English (UK), Bundle ID **com.daymartin.nicdoku** (appears after step 4's first build,
  or register it at developer.apple.com → Identifiers), SKU `nicdoku`.

### 7. Upload to TestFlight
- Destination: **Any iOS Device (arm64)** → **Product → Archive**.
- When the Organizer opens: **Distribute App → TestFlight & App Store → Distribute**.
- 5–20 minutes later the build appears in App Store Connect → Nicdoku → **TestFlight**.

### 8. Get it onto Nicola's iPhone and Watch
**Internal testing** (no Apple review, available within minutes):
1. App Store Connect → **Users and Access → +** → add Nicola's Apple ID email, role
   **Customer Support** (read-only), and under Apps give access to Nicdoku only.
2. She accepts the email invite.
3. App Store Connect → Nicdoku → **TestFlight → Internal Testing → +** group → add her → add the build.
4. On her iPhone: install **TestFlight** from the App Store, accept, install Nicdoku.
   The Watch app installs automatically if "Automatic App Install" is on in the Watch app
   (otherwise: Watch app on iPhone → Available Apps → Nicdoku → Install).

(Alternative: **External testing** by email only, no account access, but the first build needs
a short Apple beta review, usually a day.)

### 9. Move her progress across
In the web app: **Settings → Export backup** (share to Files). In the new app: **Settings → Import backup**.
Then **Settings → Family & dates → Paste a code** with the family code, as before.

---

## After that: updates without a Mac (GitHub Actions)

The workflow `.github/workflows/ios-testflight.yml` builds and uploads a new TestFlight build.

One-time: App Store Connect → **Users and Access → Integrations → App Store Connect API** →
generate a key with **App Manager** access. Download the `.p8` (only possible once).
Then GitHub repo → **Settings → Secrets and variables → Actions** → add:

| Secret | Value |
|---|---|
| `APPLE_TEAM_ID` | your Team ID |
| `ASC_KEY_ID` | the key's ID |
| `ASC_ISSUER_ID` | the Issuer ID shown above the keys |
| `ASC_KEY_P8_BASE64` | `base64 -i AuthKey_XXXX.p8` output (on Windows: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_XXXX.p8"))`) |

Then GitHub → **Actions → iOS → TestFlight → Run workflow**. Her phone updates from TestFlight.

---

## What the Watch does

| When | On the wrist |
|---|---|
| Power Hour starts (phone) | Watch app opens itself; clock, stage, combo, heart rate |
| 2 s before each spin | "get ready" tap, then a turn tap |
| Each new stage | notification tap |
| 60:00 | three strong taps and **TIME.**, then breathing with gentle in/out taps |
| Clean solves in a row | a small click as the combo grows |
| Any time | complication: break open · next break at 14:20 · resting today · her week |

Heart rate comes from a "Mind & Body" session that is **discarded** at the end, so puzzles never
count towards her Activity rings. Breaks and the Power Hour wind-down are saved as Mindful Minutes.

## If something fails
- **"No such module 'Capacitor'"**: File → Packages → Resolve Package Versions.
- **Signing errors**: check TEAM_ID in `Config.xcconfig`, re-run `./native/scripts/prepare.sh`,
  and that the Apple ID in Xcode → Settings → Accounts is on the developer team.
- **Web changes not showing**: re-run `./native/scripts/prepare.sh` (it rebuilds and re-copies the game).
- Copy any Xcode error text back to Claude; the Swift was written without a Mac, so the first
  build may need a small fix or two.
