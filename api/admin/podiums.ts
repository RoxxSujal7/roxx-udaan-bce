import { onRequest } from "../../functions/api/admin/podiums";
import { toVercelHandler } from "../../lib/server/vercel-adapter";

export default toVercelHandler(onRequest);
