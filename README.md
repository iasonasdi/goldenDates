# Golden Dates

Simple static app to coordinate group availability for a 3-day trip.

Deployed in Github Pages

## Features

- Each person enters:
  - name
  - season start/end
  - dates they **cannot** come (click on calendar)
  - preferred dates (click on calendar)
- Same person can edit their data by entering the same name.
- Group timeline view (Gantt-like row per person, day columns).
- Group month calendar overview (per-day unavailable and preferred counts).
- Best 3-day windows suggestion ranked by:
  1. fewer unavailable people
  2. higher preference score
- Minor client-side passcode gate before entering the app.

## Run locally

Open `index.html` in your browser.

## Deploy to GitHub Pages

1. Push these files to a GitHub repo.
2. In repo settings, enable GitHub Pages from branch root.
3. Open the published URL.

## Shared data backend (Google Apps Script + Google Sheet)

This project is frontend-only, so for shared data use Google Apps Script:

1. Create a Google Sheet.
2. Open **Extensions -> Apps Script**.
3. Paste the file content from `apps-script/Code.gs`.
4. In Apps Script, set server-side passcode:
   - Project Settings -> Script properties -> Add property:
     - Key: `APP_PASSCODE`
     - Value: your secret passcode (for example `Barcheloreta`)
5. In Apps Script, deploy as **Web app**:
   - Execute as: Me
   - Who has access: Anyone
6. Copy the deployment URL.
7. In `script.js`, set:

```js
const API_URL = "https://script.google.com/macros/s/your-deployment-id/exec";
```

8. Save and redeploy GitHub Pages.

## Notes

- If `API_URL` is empty, app runs in local-only mode (browser memory) for testing.
- Passcode is validated on Apps Script backend via `APP_PASSCODE` script property.
- Users still type a passcode in the UI, but it is no longer hardcoded in frontend code.
