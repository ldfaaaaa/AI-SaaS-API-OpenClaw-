import '@fastify/jwt';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      id: string;
      email?: string;
      role?: string;
      type?: string;
    };
    user: {
      id: string;
      email?: string;
      role?: string;
      type?: string;
    };
  }
}
