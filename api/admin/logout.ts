import { onRequest } from "../../functions/api/admin/logout";

export function POST(request: Request): Promise<Response> {
  return onRequest({ request });
}
