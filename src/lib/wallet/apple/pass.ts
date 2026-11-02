// What the Apple Wallet pass says: pass.json (a "store card") and its Greek
// and English strings. Pure, so it can be tested.
// Reference: https://developer.apple.com/documentation/walletpasses/pass

import { createTranslator, type MessageKey } from "../../../i18n/translate";
import { textColorOn, type Theme } from "../themes";

const el = createTranslator("el");
const en = createTranslator("en");

type Vars = Record<string, string | number>;

/**
 * pass.json holds the English text; each language's pass.strings maps that
 * text to the translation, and the iPhone shows its own language.
 */
class Strings {
  readonly el = new Map<string, string>();
  readonly en = new Map<string, string>();

  /** A string from the site's dictionaries. */
  t(key: MessageKey, vars?: Vars) {
    return this.pair(en(key, vars), el(key, vars));
  }

  /** A string given in both languages (e.g. a theme's greeting). */
  pair(english: string, greek: string) {
    this.en.set(english, english);
    this.el.set(english, greek);
    return english;
  }
}

function rgb(hex: string) {
  const n = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  return `rgb(${n(1)}, ${n(3)}, ${n(5)})`;
}

export type ApplePassCard = {
  cardNumber: string;
  customerName: string | null;
  stamps: number;
  goal: number;
  coupon: { code: string; checkUrl: string; expiresAt: string } | null;
};

export type ApplePassInput = {
  passTypeId: string;
  teamId: string;
  serial: string;
  authToken: string;
  /** Base URL of the update web service (Apple appends /v1/...). */
  webServiceUrl: string;
  cafeName: string;
  origin: string;
  theme: Theme;
  /** Null once the account is deleted: the pass is emptied and voided. */
  card: ApplePassCard | null;
};

export function buildApplePass(input: ApplePassInput) {
  const s = new Strings();
  const { theme, card } = input;
  const ink = rgb(textColorOn(theme.backgroundColor));

  const base = {
    formatVersion: 1,
    passTypeIdentifier: input.passTypeId,
    serialNumber: input.serial,
    teamIdentifier: input.teamId,
    organizationName: input.cafeName,
    description: s.t("wallet.pass.description", { cafe: input.cafeName }),
    logoText: input.cafeName,
    backgroundColor: rgb(theme.backgroundColor),
    foregroundColor: ink,
    labelColor: ink,
    webServiceURL: input.webServiceUrl,
    authenticationToken: input.authToken,
    sharingProhibited: true,
  };

  if (!card) {
    return {
      passJson: {
        ...base,
        voided: true,
        storeCard: {
          backFields: [{ key: "deleted", label: s.t("wallet.pass.deletedLabel"), value: s.t("wallet.pass.deleted") }],
        },
      },
      strings: { el: s.el, en: s.en },
    };
  }

  const coupon = card.coupon;
  const greetingEn = theme.message.en || theme.message.el;
  const greetingEl = theme.message.el || theme.message.en;

  const storeCard = {
    headerFields: [
      { key: "stamps", label: s.t("wallet.pass.stamps"), value: `${Math.min(card.stamps, card.goal)}/${card.goal}` },
    ],
    secondaryFields: [
      coupon
        ? // Changes to "Ready": the iPhone shows "Free coffee: Ready ☕" on the lock screen.
          { key: "reward", label: s.t("wallet.pass.reward"), value: s.t("wallet.pass.rewardReady"), changeMessage: s.t("wallet.pass.rewardChange") }
        : { key: "reward", label: s.t("wallet.pass.reward"), value: s.t("wallet.pass.rewardAt", { goal: card.goal }) },
    ],
    auxiliaryFields: [
      ...(card.customerName ? [{ key: "name", label: s.t("wallet.pass.name"), value: card.customerName }] : []),
      { key: "card", label: s.t("wallet.pass.cardNumber"), value: card.cardNumber, textAlignment: "PKTextAlignmentRight" },
    ],
    backFields: [
      ...(greetingEn && greetingEl
        ? [
            {
              key: "season",
              label: s.t("wallet.pass.themeHeader", { cafe: input.cafeName }),
              value: s.pair(greetingEn, greetingEl),
              // A theme with "notify" announces itself when it starts.
              ...(theme.notify ? { changeMessage: "%@" } : {}),
            },
          ]
        : []),
      ...(coupon
        ? [
            { key: "valid", label: s.t("wallet.pass.validUntil"), value: coupon.expiresAt, dateStyle: "PKDateStyleLong", timeStyle: "PKDateStyleNone" },
            { key: "code", label: s.t("wallet.pass.couponCode"), value: coupon.code },
          ]
        : []),
      { key: "rule", label: s.t("wallet.pass.ruleTitle"), value: s.t("wallet.pass.ruleBody", { goal: card.goal }) },
      {
        key: "website",
        label: s.t("wallet.pass.website"),
        value: `${input.origin}/`,
        attributedValue: `<a href="${input.origin}/">${input.origin.replace(/^https?:\/\//, "")}</a>`,
      },
    ],
  };

  return {
    passJson: {
      ...base,
      storeCard,
      ...(coupon
        ? { barcodes: [{ format: "PKBarcodeFormatQR", message: coupon.checkUrl, messageEncoding: "iso-8859-1", altText: coupon.code }] }
        : {}),
    },
    strings: { el: s.el, en: s.en },
  };
}

/** A pass.strings file: "key" = "value"; lines, UTF-16 with a byte order mark. */
export function stringsFile(entries: Map<string, string>) {
  const quote = (text: string) => `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
  const text = [...entries].map(([key, value]) => `${quote(key)} = ${quote(value)};`).join("\n") + "\n";
  const out = new Uint8Array(2 + text.length * 2);
  out[0] = 0xff;
  out[1] = 0xfe;
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    out[2 + i * 2] = unit & 0xff;
    out[3 + i * 2] = unit >> 8;
  }
  return out;
}
