import { onRequestPost } from "../functions/api/registrations";
import { callPagesHandler } from "../lib/server/vercel-adapter";

export function POST(request: Request): Promise<Response> {
  return callPagesHandler(onRequestPost, request);
}
