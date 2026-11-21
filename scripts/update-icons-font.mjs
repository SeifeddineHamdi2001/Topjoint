import { writeFile } from "node:fs/promises";
import path from "node:path";

// Keep sorted alphabetically; Google Fonts requires icon_names sorted A-Z.
const ICONS = [
  "add",
  "add_shopping_cart",
  "all_inclusive",
  "architecture",
  "arrow_back",
  "arrow_downward",
  "arrow_forward",
  "arrow_upward",
  "assignment_return",
  "attach_file",
  "auto_awesome",
  "bolt",
  "calculate",
  "call",
  "campaign",
  "cancel",
  "carpenter",
  "chat",
  "check",
  "check_box",
  "check_box_outline_blank",
  "check_circle",
  "chevron_left",
  "chevron_right",
  "close",
  "dashboard",
  "delete",
  "download",
  "error",
  "expand_more",
  "file_upload",
  "group",
  "groups",
  "hardware",
  "home",
  "image",
  "info",
  "inventory",
  "inventory_2",
  "launch",
  "link",
  "local_shipping",
  "location_on",
  "logout",
  "mail",
  "mark_email_unread",
  "menu",
  "open_in_new",
  "payments",
  "pending_actions",
  "person",
  "phone_in_talk",
  "phone_missed",
  "precision_manufacturing",
  "print",
  "privacy_tip",
  "refresh",
  "request_quote",
  "schedule",
  "search",
  "security",
  "send",
  "settings",
  "shelves",
  "shield_person",
  "shopping_bag",
  "shopping_cart",
  "star",
  "star_border",
  "star_outline",
  "straighten",
  "support_agent",
  "swap_horiz",
  "task_alt",
  "timer",
  "translate",
  "trending_down",
  "trending_up",
  "tune",
  "verified",
  "visibility",
  "visibility_off",
].sort();

const cssUrl = `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&icon_names=${ICONS.join(",")}`;
const cssRes = await fetch(cssUrl, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  },
});
if (!cssRes.ok) {
  throw new Error(`Failed to fetch Material Symbols CSS: HTTP ${cssRes.status}`);
}

const css = await cssRes.text();
const match = css.match(/url\((https:\/\/[^)]+)\)/);
if (!match) {
  throw new Error(`Could not locate font URL in Google Fonts CSS:\n${css}`);
}

const fontRes = await fetch(match[1]);
if (!fontRes.ok) {
  throw new Error(`Failed to download WOFF2 font: HTTP ${fontRes.status}`);
}

const buf = Buffer.from(await fontRes.arrayBuffer());
if (buf.subarray(0, 4).toString("ascii") !== "wOF2") {
  throw new Error("Downloaded payload does not have a valid wOF2 header");
}

const outPath = path.resolve("public/fonts/material-symbols-outlined.woff2");
await writeFile(outPath, buf);
console.log(`Updated ${outPath} (${ICONS.length} icons, ${(buf.length / 1024).toFixed(1)} KB)`);
