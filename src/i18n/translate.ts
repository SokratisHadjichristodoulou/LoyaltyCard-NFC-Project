import type { Locale } from "./config";
import type { Messages } from "./types";
import el from "./el.json";
import en from "./en.json";

// Typed against Messages so a key missing from en.json fails the build.
export const dictionaries: Record<Locale, Messages> = { el, en };

type Vars = Record<string, string | number>;

/** "a.b.c" paths to every string leaf in the dictionary. */
type Paths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends readonly unknown[]
      ? never
      : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Paths<Messages>;
type PluralBase<K> = K extends `${infer B}_one` ? B : never;
export type PluralKey = PluralBase<MessageKey>;

function lookup(messages: Messages, key: string): string {
  const value = key
    .split(".")
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages);
  return typeof value === "string" ? value : key;
}

function fill(template: string, vars?: Vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
}

export function createTranslator(locale: Locale) {
  const messages = dictionaries[locale];
  const plural = new Intl.PluralRules(locale);

  function t(key: MessageKey, vars?: Vars) {
    return fill(lookup(messages, key), vars);
  }

  /** Plural-aware lookup: picks `${key}_one` or `${key}_other` from `vars.count`. */
  t.plural = (key: PluralKey, vars: Vars & { count: number }) => {
    const form = plural.select(vars.count) === "one" ? "one" : "other";
    return fill(lookup(messages, `${key}_${form}`), vars);
  };

  t.messages = messages;
  t.locale = locale;
  return t;
}

export type Translator = ReturnType<typeof createTranslator>;
