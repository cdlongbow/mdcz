import type { FastifyReply, FastifyRequest } from "fastify";

const allowedCorsOrigins = new Set([
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
]);

export const buildCorsHeaders = (origin: string | undefined): Record<string, string> => {
  if (!origin || !allowedCorsOrigins.has(origin)) {
    return {};
  }

  return {
    "access-control-allow-origin": origin,
    vary: "Origin",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
  };
};

export const applyCorsHeaders = (request: FastifyRequest, reply: FastifyReply): void => {
  for (const [header, value] of Object.entries(buildCorsHeaders(request.headers.origin))) {
    reply.header(header, value);
  }
};
