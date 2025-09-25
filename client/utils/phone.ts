export function normalizeContact(input: unknown): string {
  if (input === null || input === undefined) return "";
  let s = String(input).trim();
  if (!s) return "";

  // Remove common formatting artifacts
  s = s.replace(/[,\s]+/g, ""); // commas and spaces

  // Handle trailing .0 from spreadsheets
  s = s.replace(/\.0$/, "");

  // If decimal remains, drop fractional part
  if (/^\d+\.\d+$/.test(s)) {
    s = s.split(".")[0];
  }

  // Handle scientific notation from Excel exports
  if (/e\+?\d+$/i.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) s = Math.round(n).toString();
  }

  return s;
}
