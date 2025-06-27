import { rateLimitAction } from "../pages/rate-limiting/action";
import { sensitiveInfoAction } from "../pages/sensitive-info/action";
import { signupAction } from "../pages/signup/action";

export const server = {
  rateLimit: rateLimitAction,
  sensitiveInfo: sensitiveInfoAction,
  signup: signupAction,
};
