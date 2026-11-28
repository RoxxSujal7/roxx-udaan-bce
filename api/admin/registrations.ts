import { onRequestGet } from "../../functions/api/admin/registrations";
import { toVercelHandler } from "../../lib/server/vercel-adapter";

export default toVercelHandler(onRequestGet);
