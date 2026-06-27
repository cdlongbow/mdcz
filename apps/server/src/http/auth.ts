import type { FastifyRequest } from "fastify";

export const getBearerToken = (request: FastifyRequest): string | undefined => {
  const authorization = request.headers.authorization;
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }

  const query = request.query as { token?: string } | undefined;
  return query?.token;
};
