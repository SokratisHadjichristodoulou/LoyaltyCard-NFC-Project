import "server-only";
import QRCode from "qrcode";
import { couponCheckUrlAt } from "./coupon-code";
import { siteOrigin } from "./site";

/** What the coupon's QR code opens (see couponCheckUrlAt). */
export async function couponCheckUrl(code: string) {
  return couponCheckUrlAt(await siteOrigin(), code);
}

/** The QR code as an SVG string, dark on white for reliable scanning. */
export async function couponQrSvg(code: string) {
  return QRCode.toString(await couponCheckUrl(code), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#2c1209", light: "#ffffff" },
  });
}
