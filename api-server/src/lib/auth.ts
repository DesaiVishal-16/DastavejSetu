import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../database/db';

const baseUrl = process.env.BASE_URL;
const frontendUrl = process.env.FRONTEND_URL;
const authSecret = process.env.BETTER_AUTH_SECRET;

if (!baseUrl) {
  throw new Error('BASE_URL environment variable is not set');
}
if (!frontendUrl) {
  throw new Error('FRONTEND_URL environment variable is not set');
}
if (!authSecret) {
  throw new Error('BETTER_AUTH_SECRET environment variable is not set');
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  baseURL: baseUrl,
  basePath: '/auth',
  emailAndPassword: {
    enabled: false,
    autoSignIn: true,
  },
  advanced: {
    cookiePrefix: 'udayam',
  },
  secret: authSecret,
  trustedOrigins: [frontendUrl],
});
