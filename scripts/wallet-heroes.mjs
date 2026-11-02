// Draws the built-in wallet banners and pass images. Run after changing a design:
//
//   public/wallet/heroes/<name>.png         Google Wallet hero, 1032 × 336 (also the card page banner)
//   public/wallet/apple/strip-<name>*.png   Apple Wallet strip, 375 × 123 at 1x, 2x and 3x
//   public/wallet/apple/icon*.png, logo*.png  Apple Wallet icon and logo, from public/logo.png
//
//   node scripts/wallet-heroes.mjs
//
// Needs Playwright with Chromium (e.g. `npx playwright install chromium` and
// `npm i -D playwright`, or any machine where require("playwright") works).

import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const W = 1032;
const H = 336;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public/wallet/heroes");
const appleOut = join(root, "public/wallet/apple");

// Deterministic "random" scatter, so re-rendering gives the same images.
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** Points spread over the banner, keeping clear of the middle (where the cup is). */
function scatter(seed, count, { clear = 150 } = {}) {
  const r = rng(seed);
  const points = [];
  while (points.length < count) {
    const x = r() * W;
    const y = r() * H;
    if (Math.abs(x - W / 2) < clear && y > 30) continue;
    points.push({ x, y, a: r() * 360, s: 0.6 + r() * 0.7, o: 0.35 + r() * 0.5 });
  }
  return points;
}

// A cup and saucer, centred on (0, 0), about 230 wide.
function cup({ body = "#f3e6d0", rim = "#d6a24e", coffee = "#5c2b18", steam = "#efc874", extra = "" } = {}) {
  return `
  <g>
    <g fill="none" stroke="${steam}" stroke-width="7" stroke-linecap="round" opacity=".85">
      <path d="M-30 -62 c-14 -18 14 -30 0 -50 c-10 -14 6 -24 2 -34" />
      <path d="M0 -66 c-14 -18 14 -30 0 -50 c-10 -14 6 -24 2 -36" />
      <path d="M30 -62 c-14 -18 14 -30 0 -50 c-10 -14 6 -24 2 -34" />
    </g>
    <ellipse cx="0" cy="70" rx="112" ry="17" fill="${rim}" />
    <ellipse cx="0" cy="66" rx="96" ry="11" fill="${body}" />
    <path d="M78 -12 h10 a26 26 0 0 1 0 52 h-16" fill="none" stroke="${body}" stroke-width="13" />
    <path d="M-80 -28 h160 v34 a80 66 0 0 1 -80 62 a80 66 0 0 1 -80 -62 z" fill="${body}" />
    <ellipse cx="0" cy="-28" rx="80" ry="12" fill="${rim}" />
    <ellipse cx="0" cy="-27" rx="70" ry="8.5" fill="${coffee}" />
    <path d="M-80 0 h160" stroke="${rim}" stroke-width="5" />
    ${extra}
  </g>`;
}

const bean = (fill, line) =>
  `<g><ellipse rx="15" ry="21" fill="${fill}" /><path d="M0 -17 c-7 9 7 19 0 34" stroke="${line}" stroke-width="3" fill="none" stroke-linecap="round" /></g>`;

function svg(background, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${background}" />
  ${body}
</svg>`;
}

const at = (p, inner, scale = 1) => `<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.a.toFixed(0)}) scale(${(p.s * scale).toFixed(2)})" opacity="${p.o.toFixed(2)}">${inner}</g>`;

const designs = {
  default: () =>
    svg(
      "#3a1609",
      `
      <radialGradient id="glow" cx="50%" cy="60%" r="45%"><stop offset="0" stop-color="#5c2b18" /><stop offset="1" stop-color="#3a1609" /></radialGradient>
      <rect width="${W}" height="${H}" fill="url(#glow)" />
      ${scatter(11, 26).map((p) => at(p, bean("#86591a", "#3a1609"))).join("")}
      <g transform="translate(${W / 2} 196)">${cup()}</g>`,
    ),

  christmas: () => {
    const flake = `<g stroke="#fff" stroke-width="3" stroke-linecap="round">${[0, 60, 120]
      .map((a) => `<g transform="rotate(${a})"><path d="M0 -16 v32" /><path d="M-5 -11 l5 4 l5 -4 M-5 11 l5 -4 l5 4" fill="none" /></g>`)
      .join("")}</g>`;
    // A fir garland along the top, with gold and white baubles.
    const r = rng(5);
    let garland = "";
    for (let x = -20; x < W + 20; x += 22) {
      const y = 18 + Math.sin(x / 90) * 8;
      for (let k = 0; k < 5; k++) {
        const a = -70 + r() * 140;
        garland += `<path d="M${x} ${y} l${(Math.sin((a * Math.PI) / 180) * 34).toFixed(1)} ${(Math.cos((a * Math.PI) / 180) * 30).toFixed(1)}" stroke="${k % 2 ? "#2e6b4f" : "#1f4d3a"}" stroke-width="6" stroke-linecap="round" />`;
      }
    }
    const baubles = [80, 210, 340, 690, 820, 950]
      .map((x, i) => {
        const y = 52 + Math.sin(x / 90) * 8 + (i % 2) * 10;
        const fill = i % 2 ? "#f3e6d0" : "#d6a24e";
        return `<path d="M${x} 20 V${y - 14}" stroke="#efc874" stroke-width="2" /><circle cx="${x}" cy="${y}" r="14" fill="${fill}" /><circle cx="${x - 4}" cy="${y - 4}" r="4" fill="#fff" opacity=".6" />`;
      })
      .join("");
    const holly = `
      <g transform="translate(-34 30)">
        <path d="M0 0 c10 -14 26 -14 34 -4 c-8 2 -10 10 -4 16 c-12 2 -24 -2 -30 -12z" fill="#2e6b4f" />
        <path d="M0 0 c-10 -14 -26 -14 -34 -4 c8 2 10 10 4 16 c12 2 24 -2 30 -12z" fill="#1f4d3a" />
        <circle cx="-5" cy="-4" r="6.5" fill="#b3261e" /><circle cx="6" cy="-7" r="6.5" fill="#c73a2f" /><circle cx="1" cy="5" r="6.5" fill="#b3261e" />
      </g>`;
    // A small Santa in his sleigh, pulled by reindeer with Rudolph in front,
    // flying in from the left under the garland. Drawn facing right.
    const reindeer = (x, y, rudolph = false) => `
      <g transform="translate(${x} ${y})">
        <path d="M-9 4 l-7 3 M-7 5 l-5 7 M8 4 l8 3 M10 3 l6 7" stroke="#8a5a2b" stroke-width="2.4" stroke-linecap="round" />
        <path d="M-14 -2 l-4 -3" stroke="#8a5a2b" stroke-width="2.4" stroke-linecap="round" />
        <ellipse cx="0" cy="0" rx="14" ry="6.5" fill="#a0672e" />
        <path d="M8 -3 L14 -14 L19 -12 L13 0 Z" fill="#a0672e" />
        <ellipse cx="19" cy="-14" rx="5.5" ry="3.4" transform="rotate(-12 19 -14)" fill="#a0672e" />
        <path d="M15 -16 l-3 -7 M15 -16 l2 -8 M12.5 -21 l-3 -1 M16.5 -21.5 l3 -2" stroke="#f3e6d0" stroke-width="1.6" stroke-linecap="round" fill="none" />
        <circle cx="16.5" cy="-15" r="0.9" fill="#2c1209" />
        ${rudolph ? `<circle cx="24.5" cy="-13" r="5" fill="#ff6b5b" opacity=".35" /><circle cx="24.5" cy="-13" r="2.4" fill="#ff3b2f" />` : `<circle cx="24.3" cy="-13" r="1.5" fill="#2c1209" />`}
      </g>`;
    const sleigh = `
      <g>
        <circle cx="-12" cy="-12" r="6" fill="#6e3b1f" />
        <circle cx="-2" cy="-12" r="7.5" fill="#d8432f" />
        <rect x="-9.5" y="-7" width="15" height="2.6" rx="1.3" fill="#f3e6d0" />
        <circle cx="2" cy="-21" r="4.3" fill="#f1c9a5" />
        <ellipse cx="3.5" cy="-18" rx="3.6" ry="3.2" fill="#ffffff" />
        <path d="M-2.5 -23 L6.5 -23 L-5 -31 Z" fill="#d8432f" />
        <rect x="-3" y="-24.5" width="10" height="2.4" rx="1.2" fill="#f3e6d0" />
        <circle cx="-5" cy="-31" r="1.8" fill="#ffffff" />
        <path d="M-20 -11 Q-22 4 -12 5 L16 5 Q22 5 24 -2 L11 -2 L7 -8 L-14 -8 Q-17 -14 -20 -11 Z" fill="#d6a24e" />
        <path d="M-16 5 v5 M12 5 v5 M-22 10 L22 10 Q30 10 30 3" stroke="#efc874" stroke-width="2.2" stroke-linecap="round" fill="none" />
      </g>`;
    const team = [[50, -4], [98, -8], [146, -12, true]];
    const sleighScene = `
      <g transform="translate(62 152) rotate(-6) scale(1.4)">
        ${[0, 1, 2, 3].map((i) => `<circle cx="${-34 - i * 12}" cy="${6 + i * 2}" r="${1.6 - i * 0.3}" fill="#efc874" opacity="${0.8 - i * 0.18}" />`).join("")}
        <path d="M24 -1 L${team[team.length - 1][0] - 8} ${team[team.length - 1][1] - 2}" stroke="#efc874" stroke-width="1.2" opacity=".8" />
        ${sleigh}
        ${team.map(([x, y, r]) => reindeer(x, y, r)).join("")}
      </g>`;
    // Snowflakes, spread evenly: each one keeps a clear gap from the others,
    // and they stay off the garland, the cup and the sleigh.
    const flakes = (() => {
      const r = rng(19);
      const placed = [];
      const free = (x, y) =>
        y > 100 && y < H - 18 && x > 18 && x < W - 18 &&
        !(x > 360 && x < 672) && // the cup and its steam
        !(x < 380 && y < 215); // the sleigh
      for (let tries = 0; tries < 4000 && placed.length < 24; tries++) {
        const x = r() * W;
        const y = r() * H;
        const s = 0.55 + r() * 0.6;
        const radius = 16 * s;
        if (!free(x, y)) continue;
        if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < p.radius + radius + 22)) continue;
        placed.push({ x, y, radius, s, a: r() * 60, o: 0.5 + s * 0.4 });
      }
      return placed;
    })();
    return svg(
      "#7d1d1d",
      `${flakes.map((p) => at(p, flake)).join("")}
      ${garland}${baubles}
      ${sleighScene}
      <g transform="translate(${W / 2} 206)">${cup({ steam: "#f3e6d0", extra: holly })}</g>`,
    );
  },

  easter: () => {
    // Red eggs, as dyed for Easter in Cyprus, and olive branches.
    const egg = (x, y, a, fill) =>
      `<g transform="translate(${x} ${y}) rotate(${a})"><path d="M0 -44 C21 -44 33 -8 33 12 C33 32 19 44 0 44 C-19 44 -33 32 -33 12 C-33 -8 -21 -44 0 -44Z" fill="${fill}" /><path d="M-31 8 C-12 14 12 2 31 8" stroke="#efc874" stroke-width="3" fill="none" opacity=".7" /><ellipse cx="-13" cy="-16" rx="6" ry="11" fill="#fff" opacity=".25" /></g>`;
    const leaf = (x, y, a, fill = "#a7b07a") => `<ellipse cx="${x}" cy="${y}" rx="22" ry="7" transform="rotate(${a} ${x} ${y})" fill="${fill}" />`;
    const branch = (x, y, flip) => {
      const d = flip ? -1 : 1;
      let s = `<path d="M${x} ${y} q${90 * d} -40 ${190 * d} -10" stroke="#8a9560" stroke-width="5" fill="none" stroke-linecap="round" />`;
      for (let i = 1; i <= 6; i++) {
        const lx = x + i * 30 * d;
        const ly = y - 22 + Math.abs(i - 3) * 4;
        s += leaf(lx, ly - 12, -30 * d, i % 2 ? "#a7b07a" : "#c4c99a") + leaf(lx + 6 * d, ly + 12, 30 * d, i % 2 ? "#c4c99a" : "#a7b07a");
      }
      s += `<circle cx="${x + 120 * d}" cy="${y - 4}" r="7" fill="#2c2a1a" /><circle cx="${x + 75 * d}" cy="${y + 2}" r="6" fill="#2c2a1a" />`;
      return s;
    };
    return svg(
      "#4f5d3a",
      `<radialGradient id="glow" cx="50%" cy="65%" r="55%"><stop offset="0" stop-color="#66764b" /><stop offset="1" stop-color="#4f5d3a" /></radialGradient>
      <rect width="${W}" height="${H}" fill="url(#glow)" />
      ${branch(40, 90, false)}${branch(W - 40, 90, true)}
      ${egg(150, 262, -12, "#b3261e")}${egg(232, 280, 14, "#9e1f18")}${egg(84, 292, 8, "#c73a2f")}
      ${egg(W - 150, 262, 12, "#b3261e")}${egg(W - 232, 280, -14, "#c73a2f")}${egg(W - 84, 292, -8, "#9e1f18")}
      <g transform="translate(${W / 2} 200)">${cup({ steam: "#f3e6d0" })}</g>`,
    );
  },

  summer: () => {
    const rays = Array.from({ length: 12 }, (_, i) => `<path d="M0 -78 v-26" transform="rotate(${i * 30})" stroke="#efc874" stroke-width="8" stroke-linecap="round" />`).join("");
    const waves = [0, 1, 2]
      .map((i) => {
        const y = 250 + i * 30;
        let d = `M0 ${y}`;
        for (let x = 0; x <= W; x += 86) d += ` q43 ${i % 2 ? 14 : -14} 86 0`;
        return `<path d="${d} V${H} H0z" fill="${["#2f7c8f", "#3d93a6", "#55aabb"][i]}" />`;
      })
      .join("");
    // An iced coffee (freddo) in a tall glass.
    const freddo = `
      <g>
        <path d="M20 -120 l38 -46" stroke="#f3e6d0" stroke-width="10" stroke-linecap="round" />
        <path d="M20 -120 l38 -46" stroke="#b3261e" stroke-width="10" stroke-linecap="round" stroke-dasharray="10 12" />
        <path d="M-64 -120 h128 l-14 214 a10 10 0 0 1 -10 9 h-80 a10 10 0 0 1 -10 -9z" fill="#ffffff" opacity=".22" />
        <path d="M-60 -82 h120 l-11 172 a8 8 0 0 1 -8 7 h-82 a8 8 0 0 1 -8 -7z" fill="#8a4a24" />
        <path d="M-62 -110 h124 l-2 30 h-120z" fill="#f3e6d0" />
        <rect x="-36" y="-50" width="34" height="34" rx="6" fill="#fff" opacity=".45" transform="rotate(-12 -19 -33)" />
        <rect x="8" y="-30" width="32" height="32" rx="6" fill="#fff" opacity=".4" transform="rotate(14 24 -14)" />
        <rect x="-22" y="10" width="30" height="30" rx="6" fill="#fff" opacity=".35" transform="rotate(6 -7 25)" />
      </g>`;
    return svg(
      "#1f5f73",
      `<g transform="translate(870 92)">${rays}<circle r="62" fill="#efc874" /></g>
      ${waves}
      <g transform="translate(${W / 2} 205)">${freddo}</g>`,
    );
  },

  autumn: () => {
    const leafShape = (fill) =>
      `<g><path d="M0 -26 c8 8 14 6 20 4 c-2 8 0 12 6 16 c-8 4 -10 8 -8 16 c-8 -2 -12 0 -14 6 l-4 -10 l-4 10 c-2 -6 -6 -8 -14 -6 c2 -8 0 -12 -8 -16 c6 -4 8 -8 6 -16 c6 2 12 4 20 -4z" fill="${fill}" /><path d="M0 -18 V30" stroke="#3a1609" stroke-width="2" opacity=".4" /></g>`;
    const colors = ["#d9822b", "#d6a24e", "#a8431f", "#efc874", "#c25a1e"];
    return svg(
      "#6e3412",
      `<radialGradient id="glow" cx="50%" cy="62%" r="50%"><stop offset="0" stop-color="#8a4a24" /><stop offset="1" stop-color="#6e3412" /></radialGradient>
      <rect width="${W}" height="${H}" fill="url(#glow)" />
      ${scatter(23, 28, { clear: 160 }).map((p, i) => at({ ...p, o: 0.75 + p.o * 0.25 }, leafShape(colors[i % colors.length]), 1.3)).join("")}
      <g transform="translate(${W / 2} 200)">${cup({ steam: "#f3e6d0" })}</g>`,
    );
  },
};

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
mkdirSync(out, { recursive: true });
mkdirSync(appleOut, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });

async function shoot(markup, width, height, path) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`);
  await page.locator("body > *").first().screenshot({ path, omitBackground: true });
}

for (const [name, draw] of Object.entries(designs)) {
  const art = draw();
  await shoot(art, W, H, join(out, `${name}.png`));
  // Apple's strip is a little narrower (375 × 123): the same art, cropped to fill.
  for (const [scale, suffix] of [[1, ""], [2, "@2x"], [3, "@3x"]]) {
    const [w, h] = [375 * scale, 123 * scale];
    const strip = art.replace(`width="${W}" height="${H}"`, `width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"`);
    await shoot(strip, w, h, join(appleOut, `strip-${name}${suffix}.png`));
  }
  console.log(`drew ${name}`);
}

// Icon (29 pt, shown in notifications) and logo (top left of the pass), from the round logo.
const logo = `data:image/png;base64,${readFileSync(join(root, "public/logo.png")).toString("base64")}`;
for (const [file, size] of [["icon.png", 29], ["icon@2x.png", 58], ["icon@3x.png", 87], ["logo.png", 50], ["logo@2x.png", 100], ["logo@3x.png", 150]]) {
  await shoot(`<img src="${logo}" width="${size}" height="${size}" style="display:block">`, size, size, join(appleOut, file));
}
console.log("drew the Apple pass icon and logo");
await browser.close();
