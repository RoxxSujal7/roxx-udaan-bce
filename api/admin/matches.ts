import { onRequest } from "../../functions/api/admin/matches";
import { toVercelHandler } from "../../lib/server/vercel-adapter";

export default toVercelHandler(onRequest);
