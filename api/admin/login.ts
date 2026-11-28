import { onRequest } from "../../functions/api/admin/login";
import { callPagesHandler } from "../../lib/server/vercel-adapter";

export function POST(request: Request): Promise<Response> {
  return callPagesHandler(onRequest, request);
}
