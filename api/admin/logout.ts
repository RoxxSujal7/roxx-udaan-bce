import { onRequest } from "../../functions/api/admin/logout";
import { toVercelHandler } from "../../lib/server/vercel-adapter";

export default toVercelHandler(onRequest);
