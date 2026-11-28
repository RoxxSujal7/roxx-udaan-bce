import { onRequest } from "../../functions/api/admin/matches";
import { callPagesHandler } from "../../lib/server/vercel-adapter";

export function POST(request: Request): Promise<Response> {
  return callPagesHandler(onRequest, request);
}

export function PATCH(request: Request): Promise<Response> {
  return callPagesHandler(onRequest, request);
}

export function DELETE(request: Request): Promise<Response> {
  return callPagesHandler(onRequest, request);
}
