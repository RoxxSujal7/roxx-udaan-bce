import { onRequestGet } from "../../functions/api/admin/registrations";
import { callPagesHandler } from "../../lib/server/vercel-adapter";

export function GET(request: Request): Promise<Response> {
  return callPagesHandler(onRequestGet, request);
}
