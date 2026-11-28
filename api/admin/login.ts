import { onRequest } from "../../functions/api/admin/login";
import { toVercelHandler } from "../../lib/server/vercel-adapter";

export default toVercelHandler(onRequest);
