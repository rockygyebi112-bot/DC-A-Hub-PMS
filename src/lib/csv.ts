/**
 * Minimal RFC-4180 CSV parser.
 *
 * The previous MIS importer split each line on `,` which silently corrupts any
 * row containing a quoted field with an embedded comma (e.g. "Tamale, Northern")
 * — every column to the right shifts by one and lands in the wrong DB field.
 *
 * This handles the cases a hand-rolled split cannot:
 *   - quoted fields:            a,"b,c",d        -> ["a", "b,c", "d"]
 *   - doubled-quote escaping:   "she said ""hi"""-> ['she said "hi"']
 *   - embedded newlines:        "line1\nline2"   -> single field
 *   - CRLF or LF line endings
 *   - a leading UTF-8 BOM
 *
 * Returns an array of records, each an array of raw string cells (no trimming —
 * callers decide). Fully-blank lines are dropped.
 */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Tracks whether the current logical row has any content at all, so a file
  // ending in a trailing newline doesn't emit a spurious empty record.
  let sawAny = false;

  let start = 0;
  if (input.charCodeAt(0) === 0xfeff) start = 1; // strip BOM

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  for (let i = start; i < input.length; i++) {
    const c = input[i];

    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++; // consume the escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      sawAny = true;
      continue;
    }

    switch (c) {
      case '"':
        inQuotes = true;
        sawAny = true;
        break;
      case ",":
        pushField();
        sawAny = true;
        break;
      case "\r":
        break; // swallow; the \n handles the row break
      case "\n":
        pushField();
        pushRow();
        sawAny = false;
        break;
      default:
        field += c;
        sawAny = true;
    }
  }

  // Flush a trailing field/row when the file doesn't end on a newline.
  if (sawAny || field.length > 0 || row.length > 0) {
    pushField();
    pushRow();
  }

  // Drop fully-empty lines (a single empty cell and nothing else).
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}
