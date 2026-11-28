import { onRequest } from "../../functions/api/admin/announcements";
import { toVercelHandler } from "../../lib/server/vercel-adapter";

export default toVercelHandler(onRequest);
