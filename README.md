# Gym Logger PWA

A Progressive Web App (PWA) for logging workouts offline, storing your metrics in a local Dexie.js database, and optionally backing up your logs to a private application folder in Google Drive. 

## Features Built

1. **Offline-First & Durable Storage**: Uses **IndexedDB** wrapped with **Dexie.js** as the single source of truth. Includes automated storage persistence requests to prevent the browser from evicting workout records.
2. **Train (Today screen)**:
   - Start freestyle workout or select from pre-seeded routines ("Push Day", "Pull Day", "Leg Day").
   - Stats strip showing active tracking (exercises count, completed sets, and total volume logged).
   - Collapsible workout exercise views where only the active exercise is expanded.
   - Set-level pre-filling from previous training sessions ("Last time:..." ghost records) with quick +/- steppers.
   - Searchable exercise library modal with muscle filters and "Create Custom Exercise" capability.
3. **History screen**: Listing of all completed training sessions, expandable to review full set logs or delete records.
4. **Progress screen**: Custom inline **SVG charts** graphing Estimated 1-Rep Max (Epley Formula) and Top Set Weight trends over time per logged exercise without bloat.
5. **Settings screen**:
   - Durable Storage request trigger.
   - Local JSON backup export/import utility.
   - Client-side Google Drive sync using OAuth 2.0 with PKCE and the `drive.appdata` scope. Handles two-way merges (last-write-wins based on `updatedAt` timestamps).

---

## Technical Specifications

- **Client**: React 19 + TypeScript + Vite
- **PWA Configuration**: `vite-plugin-pwa` registers a self-updating Service Worker which caches all application assets, stylesheets, scripts, and Google Fonts.
- **Database Schema**:
  - `exercises`: `id (uuid)`, `name`, `muscleGroup`, `isCustom`, `updatedAt`
  - `routines`: `id (uuid)`, `name`, `dayLabel`, `exercises (json array)`, `updatedAt`
  - `workouts`: `id (uuid)`, `date`, `routineId`, `status`, `updatedAt`
  - `sets`: `id (uuid)`, `workoutId`, `exerciseId`, `setNumber`, `weight`, `reps`, `completed`, `completedAt`, `updatedAt`

---

## How to Run Locally

1. Clone or navigate to the project directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Access the web app in your browser at `http://localhost:5173`.

---

## PWA Installation

Once the app is running in your browser:
- **Mobile (iOS Safari)**: Tap the "Share" icon -> Select **"Add to Home Screen"**.
- **Mobile (Android Chrome)**: Tap the three-dot menu -> Select **"Install app"** or **"Add to Home screen"**.
- **Desktop (Chrome/Edge)**: Tap the install icon on the right side of the address bar.

---

## Google Drive Integration Setup

To activate the Google Drive Backup feature:
1. Go to the **Google Cloud Console**.
2. Create a project and set up the **OAuth consent screen** (external testing mode is fine).
3. Under credentials, create an **OAuth Client ID** for **Web Application**.
4. Add your redirect URI (e.g. `http://localhost:5173` or your production domain) under **Authorized JavaScript origins** and **Authorized redirect URIs**.
5. Paste the generated **Client ID** into the Google Client ID input in the app's **Settings** screen.
6. Click **Connect Google Drive** and log in. The app will save backups under a private folder (`drive.appdata`) which is hidden from other applications.
