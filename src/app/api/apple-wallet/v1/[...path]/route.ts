import { NextResponse, type NextRequest } from "next/server";
import { siteOrigin } from "@/lib/site";
import { appleWalletConfig } from "@/lib/wallet/apple/config";
import { parseServicePath } from "@/lib/wallet/apple/service";
import {
  applePassForDevice,
  authorizedPass,
  registerDevice,
  unregisterDevice,
  updatedSerials,
} from "@/lib/wallet/apple/sync";

// Apple's PassKit web service, called by iPhones holding the pass
// (webServiceURL in pass.json is <site>/api/apple-wallet):
//
//   POST   /v1/devices/<device>/registrations/<passType>/<serial>   register for updates
//   DELETE /v1/devices/<device>/registrations/<passType>/<serial>   unregister (pass removed)
//   GET    /v1/devices/<device>/registrations/<passType>?passesUpdatedSince=<tag>
//   GET    /v1/passes/<passType>/<serial>                           the latest pass
//   POST   /v1/log                                                  the phone's error messages
//
// https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes

type Context = { params: Promise<{ path: string[] }> };

const empty = (status: number) => new NextResponse(null, { status });

async function route(request: NextRequest, context: Context) {
  const config = appleWalletConfig();
  if (!config) return empty(404);
  const call = parseServicePath(request.method, (await context.params).path, config.passTypeId);
  const authorization = request.headers.get("authorization");

  switch (call?.kind) {
    case "register": {
      if (!(await authorizedPass(call.serial, authorization))) return empty(401);
      const body = (await request.json().catch(() => null)) as { pushToken?: unknown } | null;
      const pushToken = typeof body?.pushToken === "string" ? body.pushToken : "";
      if (!/^[0-9a-fA-F]{20,200}$/.test(pushToken)) return empty(400);
      const result = await registerDevice(call.device, call.serial, pushToken);
      return empty(result === "created" ? 201 : 200);
    }
    case "unregister": {
      if (!(await authorizedPass(call.serial, authorization))) return empty(401);
      await unregisterDevice(call.device, call.serial);
      return empty(200);
    }
    case "list": {
      const changed = await updatedSerials(call.device, request.nextUrl.searchParams.get("passesUpdatedSince"));
      return changed ? NextResponse.json(changed) : empty(204);
    }
    case "pass": {
      const pass = await authorizedPass(call.serial, authorization);
      if (!pass) return empty(401);
      // Always the full pass: phones only ask after a push, and a "not modified"
      // based on whole-second HTTP dates could hide a second change in the same second.
      const bytes = await applePassForDevice(await siteOrigin(), pass);
      return new NextResponse(bytes, {
        headers: {
          "content-type": "application/vnd.apple.pkpass",
          "last-modified": new Date(pass.updated_at).toUTCString(),
          "cache-control": "no-store",
        },
      });
    }
    case "log": {
      const body = (await request.json().catch(() => null)) as { logs?: unknown } | null;
      const logs = Array.isArray(body?.logs) ? body.logs.slice(0, 20) : [];
      for (const line of logs) console.warn("Apple Wallet (from a phone):", String(line).slice(0, 500));
      return empty(200);
    }
    default:
      return empty(404);
  }
}

export async function GET(request: NextRequest, context: Context) {
  return handle(request, context);
}
export async function POST(request: NextRequest, context: Context) {
  return handle(request, context);
}
export async function DELETE(request: NextRequest, context: Context) {
  return handle(request, context);
}

async function handle(request: NextRequest, context: Context) {
  try {
    return await route(request, context);
  } catch (error) {
    console.error("Apple Wallet: web service error", error);
    return empty(500);
  }
}
