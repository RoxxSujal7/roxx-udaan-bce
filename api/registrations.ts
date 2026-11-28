import { onRequestPost } from "../functions/api/registrations";
import { toVercelHandler } from "../lib/server/vercel-adapter";

export default toVercelHandler(onRequestPost);
