import { onRequest } from "../../functions/api/admin/brackets";
import { toVercelHandler } from "../../lib/server/vercel-adapter";

export default toVercelHandler(onRequest);
