import { rateLimitAction } from "../pages/rate-limiting/_action";
import { sensitiveInfoAction } from "../pages/sensitive-info/_action";
import { signupAction } from "../pages/signup/_action";

export const server = {
  rateLimit: rateLimitAction,
  sensitiveInfo: sensitiveInfoAction,
  signup: signupAction,
};
