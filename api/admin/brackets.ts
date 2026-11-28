import { onRequest } from "../../functions/api/admin/brackets";
import { callPagesHandler } from "../../lib/server/vercel-adapter";

export function PUT(request: Request): Promise<Response> {
  return callPagesHandler(onRequest, request);
}

export function DELETE(request: Request): Promise<Response> {
  return callPagesHandler(onRequest, request);
}
