/**
 * Google Apps Script backend for Golden Dates.
 * Deploy as Web App and paste that URL into script.js API_URL.
 *
 * Sheet columns:
 * A name
 * B seasonStart
 * C seasonEnd
 * D unavailableDates (JSON string array)
 * E preferredDates (JSON string array)
 * F updatedAt
 */
const SHEET_NAME = "availability";
const PASSCODE_PROPERTY_KEY = "APP_PASSCODE";

function doGet(e) {
  try {
    const passcode = String((e && e.parameter && e.parameter.passcode) || "");
    if (!isAuthorized_(passcode)) return json_({ ok: false, error: "Unauthorized" });
    const sheet = getSheet_();
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return json_({ entries: [] });
    const rows = values.slice(1);
    const entries = rows
      .filter((r) => r[0])
      .map((r) => ({
        name: String(r[0] || ""),
        seasonStart: String(r[1] || ""),
        seasonEnd: String(r[2] || ""),
        unavailableDates: parseJsonArray_(r[3]),
        preferredDates: parseJsonArray_(r[4]),
        updatedAt: String(r[5] || ""),
      }));
    return json_({ entries });
  } catch (error) {
    return json_({ error: String(error) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    if (!isAuthorized_(String(body.passcode || ""))) return json_({ ok: false, error: "Unauthorized" });
    const name = String(body.name || "").trim();
    if (!name) return json_({ ok: false, error: "name is required" });

    const rowData = [
      name,
      String(body.seasonStart || ""),
      String(body.seasonEnd || ""),
      JSON.stringify(body.unavailableDates || []),
      JSON.stringify(body.preferredDates || []),
      String(body.updatedAt || new Date().toISOString()),
    ];

    const sheet = getSheet_();
    const values = sheet.getDataRange().getValues();
    let mode = "created";

    for (let i = 1; i < values.length; i += 1) {
      if (String(values[i][0]).toLowerCase() === name.toLowerCase()) {
        sheet.getRange(i + 1, 1, 1, rowData.length).setValues([rowData]);
        mode = "updated";
        return json_({ ok: true, mode });
      }
    }

    sheet.appendRow(rowData);
    return json_({ ok: true, mode });
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  }
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["name", "seasonStart", "seasonEnd", "unavailableDates", "preferredDates", "updatedAt"]);
  }
  return sheet;
}

function parseJsonArray_(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function isAuthorized_(providedPasscode) {
  const expected = String(PropertiesService.getScriptProperties().getProperty(PASSCODE_PROPERTY_KEY) || "");
  if (!expected) {
    throw new Error("Missing APP_PASSCODE script property");
  }
  return String(providedPasscode || "") === expected;
}
