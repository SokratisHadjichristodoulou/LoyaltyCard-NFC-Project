import type el from "./el.json";

// Greek is the source of truth; every other language must match its shape.
export type Messages = typeof el;
