import "server-only";
import QRCode from "qrcode";
import { siteOrigin } from "./site";

/**
 * What the coupon's QR code opens: the staff page with the code filled in.
 * The code itself is the secret (16 random characters); the staff page looks
 * it up and redeems it once, so a screenshot cannot be used twice.
 */
export async function couponCheckUrl(code: string) {
  return `${await siteOrigin()}/staff?code=${encodeURIComponent(code)}`;
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
