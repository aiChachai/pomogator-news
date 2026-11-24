import { lstatSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import Ajv from "ajv";
import { parseDocument } from "yaml";
import newsSchema from "../schema/news.schema.json" with { type: "json" };

const countries = new Set(`
  AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
  CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR
  GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP
  KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT
  MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW
  SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG
  UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW
`.trim().split(/\s+/));

export const ajv = new Ajv({ allErrors: true });
ajv.addFormat("iso-country", (value) => countries.has(value));
ajv.addFormat("language", (value) => {
  try {
    return Intl.getCanonicalLocales(value).length === 1;
  } catch {
    return false;
  }
});
ajv.addFormat("date-only", (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
});
ajv.addFormat("https-url", (value) => {
  try {
    const url = new URL(value);
    return /^https:\/\//.test(value) && !url.username && !url.password && !/\s/.test(value);
  } catch {
    return false;
  }
});

export function hasImages(text) {
  return /!\[|<(?:img|picture|svg)\b/i.test(text);
}

const validate = ajv.compile(newsSchema);

function fail(file, reason) {
  throw new Error(`${JSON.stringify(file)}: ${reason}`);
}

export function parseNews(file, raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/.exec(raw);
  if (!match) fail(file, "a YAML frontmatter block is required");
  if (match[2].trim()) fail(file, "Markdown body is not allowed");
  const document = parseDocument(match[1]);
  if (document.errors.length || document.warnings.length) fail(file, "invalid YAML frontmatter");
  let record;
  try {
    record = document.toJS({ maxAliasCount: 0 });
  } catch {
    fail(file, "invalid YAML values or aliases");
  }
  if (!validate(record)) fail(file, ajv.errorsText(validate.errors));
  const id = path.basename(file, ".md");
  const year = path.basename(path.dirname(file));
  if (id !== record.id || !id.startsWith(record.date + "-") || year !== record.date.slice(0, 4)) {
    fail(file, "id, date, year directory, and filename must match");
  }
  if ([record.source, record.title_original, ...Object.values(record.summary)].some(hasImages)) {
    fail(file, "images are not allowed in news");
  }
  return record;
}

export function readNews(directory) {
  let root;
  try {
    root = lstatSync(directory);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  if (!root.isDirectory()) fail(directory, "expected a news directory");
  const items = [];
  for (const year of readdirSync(directory, { withFileTypes: true })) {
    if (!year.isDirectory() || !/^\d{4}$/.test(year.name)) {
      fail(year.name, "expected a four-digit year directory");
    }
    const folder = path.join(directory, year.name);
    for (const file of readdirSync(folder, { withFileTypes: true })) {
      const relative = path.join(year.name, file.name);
      if (!file.isFile() || !file.name.endsWith(".md")) fail(relative, "expected a Markdown news file");
      items.push(parseNews(relative, readFileSync(path.join(folder, file.name), "utf8")));
    }
  }
  return items.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
