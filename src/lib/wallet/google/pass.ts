// What the Google Wallet pass looks like: the loyalty class (shared by every
// card: logo, colour, banner, theme greeting) and each customer's loyalty
// object (stamps, name, coupon QR). Pure functions, so they can be tested.
// Field reference: https://developers.google.com/wallet/reference/rest/v1/loyaltyclass

import { intlLocale } from "../../../i18n/config";
import { createTranslator, type MessageKey } from "../../../i18n/translate";
import { heroImageUrl, type Theme } from "../themes";

const el = createTranslator("el");
const en = createTranslator("en");

type Vars = Record<string, string | number>;

/**
 * A string in both languages. Google shows the one matching the phone's
 * language; English is the fallback for phones in any other language.
 */
export function localized(elValue: string, enValue: string) {
  return {
    defaultValue: { language: "en", value: enValue },
    translatedValues: [{ language: "el", value: elValue }],
  };
}

function both(key: MessageKey, vars?: Vars) {
  return { el: el(key, vars), en: en(key, vars) };
}

/** A text field Google wants as plain value + translations. */
function text(key: MessageKey, vars?: Vars) {
  const t = both(key, vars);
  return { value: t.en, localized: localized(t.el, t.en) };
}

function formatDate(iso: string, locale: "el" | "en") {
  return new Intl.DateTimeFormat(intlLocale[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Nicosia",
  }).format(new Date(iso));
}

export type ClassInput = {
  classId: string;
  cafeName: string;
  stampsRequired: number;
  theme: Theme;
  origin: string;
};

export function buildLoyaltyClass({ classId, cafeName, stampsRequired, theme, origin }: ClassInput) {
  const program = text("wallet.pass.programName");
  const cardNumber = text("wallet.pass.cardNumber");
  const name = text("wallet.pass.name");
  const ruleTitle = text("wallet.pass.ruleTitle");
  const ruleBody = text("wallet.pass.ruleBody", { goal: stampsRequired });
  const greeting = theme.message.el || theme.message.en;
  const fromCafe = text("wallet.pass.themeHeader", { cafe: cafeName });
  const textModulesData = [
    ...(greeting
      ? [
          {
            id: "theme",
            header: fromCafe.value,
            localizedHeader: fromCafe.localized,
            body: theme.message.en || greeting,
            localizedBody: localized(theme.message.el || greeting, theme.message.en || greeting),
          },
        ]
      : []),
    { id: "rule", header: ruleTitle.value, localizedHeader: ruleTitle.localized, body: ruleBody.value, localizedBody: ruleBody.localized },
  ];

  return {
    id: classId,
    issuerName: cafeName,
    programName: program.value,
    localizedProgramName: program.localized,
    programLogo: {
      sourceUri: { uri: `${origin}/wallet/logo.png` },
      contentDescription: localized(cafeName, cafeName),
    },
    heroImage: {
      sourceUri: { uri: heroImageUrl(theme.heroImage, origin) },
      contentDescription: localized(theme.name, theme.name),
    },
    hexBackgroundColor: theme.backgroundColor,
    accountIdLabel: cardNumber.value,
    localizedAccountIdLabel: cardNumber.localized,
    accountNameLabel: name.value,
    localizedAccountNameLabel: name.localized,
    textModulesData,
    homepageUri: { uri: `${origin}/`, description: cafeName },
    countryCode: "CY",
    // A card belongs to one customer, on any of their devices.
    multipleDevicesAndHoldersAllowedStatus: "ONE_USER_ALL_DEVICES",
    // Google's rule: keep sending underReview, also when updating an approved class.
    reviewStatus: "UNDER_REVIEW",
  };
}

export type ObjectInput = {
  objectId: string;
  classId: string;
  cardNumber: string;
  customerName: string | null;
  stamps: number;
  goal: number;
  /** The usable coupon to show as a QR code, if any. */
  coupon: { code: string; checkUrl: string; expiresAt: string } | null;
  origin: string;
};

type MessageType = "TEXT" | "TEXT_AND_NOTIFY";

/** The "free coffee ready" message. TEXT_AND_NOTIFY also shows a phone notification. */
export function couponMessage(code: string, type: MessageType) {
  const header = text("wallet.pass.couponTitle");
  const body = text("wallet.pass.couponNotify");
  return {
    id: `coupon-${code}`,
    header: header.value,
    localizedHeader: header.localized,
    body: body.value,
    localizedBody: body.localized,
    messageType: type,
  };
}

/** The message sent to every card when a theme with "notify" starts. */
export function themeMessage(theme: Theme, cafeName: string) {
  // The theme's greeting, or "From Coffee Pause Cyprus" when it has none.
  const fallback = both("wallet.pass.themeHeader", { cafe: cafeName });
  const headerEl = theme.message.el || theme.message.en || fallback.el;
  const headerEn = theme.message.en || theme.message.el || fallback.en;
  const body = text("wallet.pass.themeNotify");
  return {
    id: `theme-${theme.key.replace(/[^A-Za-z0-9_-]/g, "-")}`,
    header: headerEn,
    localizedHeader: localized(headerEl, headerEn),
    body: body.value,
    localizedBody: body.localized,
    messageType: "TEXT_AND_NOTIFY" as const,
  };
}

/**
 * The customer's pass, complete: sent with PUT, so anything left out (an old
 * coupon's QR code) disappears from the pass.
 */
export function buildLoyaltyObject(input: ObjectInput, { couponMessageType = "TEXT" as MessageType | null } = {}) {
  const stamps = text("wallet.pass.stamps");
  const myCard = text("wallet.pass.openCard");
  const filled = Math.min(input.stamps, input.goal);
  const coupon = input.coupon;
  const couponTitle = text("wallet.pass.couponTitle");
  const couponBody = coupon
    ? {
        el: el("wallet.pass.couponBody", { date: formatDate(coupon.expiresAt, "el") }),
        en: en("wallet.pass.couponBody", { date: formatDate(coupon.expiresAt, "en") }),
      }
    : null;

  return {
    id: input.objectId,
    classId: input.classId,
    state: "ACTIVE",
    accountId: input.cardNumber,
    ...(input.customerName ? { accountName: input.customerName } : {}),
    loyaltyPoints: {
      label: stamps.value,
      localizedLabel: stamps.localized,
      balance: { string: `${filled}/${input.goal}` },
    },
    ...(coupon
      ? {
          barcode: { type: "QR_CODE", value: coupon.checkUrl, alternateText: coupon.code },
          textModulesData: [
            {
              id: "coupon",
              header: couponTitle.value,
              localizedHeader: couponTitle.localized,
              body: couponBody!.en,
              localizedBody: localized(couponBody!.el, couponBody!.en),
            },
          ],
        }
      : {}),
    messages: coupon && couponMessageType ? [couponMessage(coupon.code, couponMessageType)] : [],
    linksModuleData: {
      uris: [{ id: "card", uri: `${input.origin}/`, description: myCard.value, localizedDescription: myCard.localized }],
    },
  };
}

/**
 * What a pass becomes when its customer deletes their account: no name,
 * stamps or coupon, moved to the expired passes.
 */
export function buildRetiredObject(objectId: string, classId: string) {
  return { id: objectId, classId, state: "INACTIVE" };
}

/** Claims of the "Add to Google Wallet" link; the object already exists, so only its id is sent. */
export function saveLinkClaims({ email, origin, objectId, classId, now = Date.now() }: {
  email: string;
  origin: string;
  objectId: string;
  classId: string;
  now?: number;
}) {
  return {
    iss: email,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(now / 1000),
    origins: [origin],
    payload: { loyaltyObjects: [{ id: objectId, classId }] },
  };
}
