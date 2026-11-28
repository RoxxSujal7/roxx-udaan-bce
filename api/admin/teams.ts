import { onRequest } from "../../functions/api/admin/teams";
import { toVercelHandler } from "../../lib/server/vercel-adapter";

export default toVercelHandler(onRequest);
