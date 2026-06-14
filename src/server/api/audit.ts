import { authorizeApiRequest } from "@/server/auth/guard";

export async function getAuthorizedUserId(request: Request) {
  const authorization = await authorizeApiRequest(request, []);

  if (!authorization.authorized) {
    return authorization;
  }

  return {
    authorized: true as const,
    userId: authorization.user.userId,
  };
}
