# Plan

Five distinct chunks. I'll confirm scope here, then implement in order.

## 1. Logo APK = logo plateforme
- The web/plateforme logo is `Nettobloc.png` (already used in auth and headers).
- Important: the **APK launcher icon** lives in native Android files (`android/app/src/main/res/mipmap-*`). These are **not in this Lovable repo** — they only exist on your machine after `npx cap add android`. So I cannot change the installed app icon from here.
- What I CAN do in the repo: make sure the splash / in-app branding and the PWA/favicon all use `Nettobloc.png` consistently.
- What YOU must do once, on your machine: replace the icons in `android/app/src/main/res/mipmap-*` with the Nettobloc logo (or run an icon generator), then rebuild the APK. I'll give you the exact steps.

## 2. Auth: only staff roles, persisted after refresh
- Today `mode=staff` (from the Capacitor start URL) hides "Établissement" and shows Équipe / Gouvernante / Technicien / Cafetière.
- Problem: the `mode=staff` URL param is lost on internal navigation/refresh.
- Fix: when `mode=staff` is detected once, persist a flag in `localStorage` and read staff-mode from URL **or** that flag. This keeps the staff-only auth after refresh and across pages.

## 3. Language from the phone configuration
- `detectBrowserLanguage()` already reads `navigator.language` (EN → English, else French).
- Fix for APK reliability: prefer the device locale (Capacitor `Device.getLanguageCode()` when running natively) and only fall back to a saved choice if the user explicitly switched language in-app. This guarantees: phone in English → auth in English; phone in French → auth in French.

## 4. Governess hotel switching logic
- On the dashboard, when a hotel is already selected (inside an establishment):
  - Hide "Demander l'accès à un autre hôtel".
  - Hide the list of other hotels.
- To change hotel, the governess uses "Retour" or a building icon that returns to the hotels hub (`/governess/hotels`), where the add-hotel and other-hotels options live.
- Net effect: add/other-hotels only appear on the hub page, never while working inside an establishment.

## 5. App-style redesign of the 4 staff pages
Target pages: Gouvernante, Équipe (femme de chambre), Cafetière, Technicien.
- Goal: a clean native-app feel — consistent header with logo + role color, large tap-friendly buttons, card-based feature tiles, bottom-safe spacing, role identity colors already defined (Gouvernante=Amber, Équipe=Violet, Technicien=Blue, Cafetière + Établissement=Emerald).
- This is the biggest and most subjective chunk. I'll do it page by page so you can review each.

```text
[ Logo + role color header ]
[ Hotel name / status ]
[  feature tile  ][  feature tile  ]
[  feature tile  ][  feature tile  ]
[ primary action button ]
```

## Suggested order
1. Auth persistence (#2) + language (#3) — quick, high impact.
2. Governess hotel logic (#4).
3. Logo consistency in-repo (#1) + instructions for the native icon.
4. Redesign the 4 pages (#5), one at a time.

## Question
For #5, do you want me to redesign all 4 pages directly in your existing color system (faster), or generate visual design directions for you to pick from first (slower, but you choose the look)?
