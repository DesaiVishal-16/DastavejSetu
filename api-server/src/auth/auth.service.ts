import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { db } from '../database/db';
import { session, user } from '../database/schema';
import { nanoid } from 'nanoid';

interface UserInfo {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image?: string | null;
}

interface SessionInfo {
  user: UserInfo;
  session: {
    id: string;
    token: string;
    expiresAt: Date;
  };
}

interface RequestInfo {
  ipAddress?: string;
  userAgent?: string;
}

interface SignupOrLoginResult {
  success: boolean;
  message?: string;
  user?: UserInfo;
  token?: string;
  isNewUser?: boolean;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * Signup or login - creates user if doesn't exist, logs in if exists
   */
  async signupOrLogin(
    email: string,
    name: string,
    requestInfo?: RequestInfo,
  ): Promise<SignupOrLoginResult> {
    try {
      // Check if user exists
      const existingUsers = await db
        .select()
        .from(user)
        .where(eq(user.email, email));

      let currentUser: UserInfo;
      let isNewUser = false;

      if (existingUsers.length > 0) {
        // User exists - login
        const existingUser = existingUsers[0];
        currentUser = {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          emailVerified: existingUser.emailVerified,
          image: existingUser.image,
        };
      } else {
        // Create new user
        const userId = nanoid();
        await db.insert(user).values({
          id: userId,
          email,
          name,
          emailVerified: true,
        });

        currentUser = {
          id: userId,
          email,
          name,
          emailVerified: true,
          image: null,
        };
        isNewUser = true;
      }

      // Create session
      const sessionToken = nanoid(32);
      const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await db.insert(session).values({
        id: nanoid(),
        userId: currentUser.id,
        token: sessionToken,
        expiresAt: sessionExpiresAt,
        ipAddress: requestInfo?.ipAddress,
        userAgent: requestInfo?.userAgent,
      });

      this.logger.log(
        `${isNewUser ? 'Created new user' : 'User logged in'}: ${email}`,
      );

      return {
        success: true,
        user: currentUser,
        token: sessionToken,
        isNewUser,
      };
    } catch (error: unknown) {
      this.logger.error(`Failed to signup/login: ${String(error)}`);
      return {
        success: false,
        message: 'Failed to process request',
      };
    }
  }

  /**
   * Login existing user
   */
  async login(
    email: string,
    requestInfo?: RequestInfo,
  ): Promise<SignupOrLoginResult> {
    try {
      // Check if user exists
      const existingUsers = await db
        .select()
        .from(user)
        .where(eq(user.email, email));

      if (existingUsers.length === 0) {
        return {
          success: false,
          message: 'User not found. Please sign up first.',
        };
      }

      const existingUser = existingUsers[0];

      // Create session
      const sessionToken = nanoid(32);
      const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await db.insert(session).values({
        id: nanoid(),
        userId: existingUser.id,
        token: sessionToken,
        expiresAt: sessionExpiresAt,
        ipAddress: requestInfo?.ipAddress,
        userAgent: requestInfo?.userAgent,
      });

      this.logger.log(`User logged in: ${email}`);

      return {
        success: true,
        user: {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          emailVerified: existingUser.emailVerified,
          image: existingUser.image,
        },
        token: sessionToken,
        isNewUser: false,
      };
    } catch (error: unknown) {
      this.logger.error(`Failed to login: ${String(error)}`);
      return {
        success: false,
        message: 'Failed to login',
      };
    }
  }

  /**
   * Get session information from token
   */
  async getSession(token: string): Promise<SessionInfo | null> {
    try {
      // Look up session in database
      const sessionRecord = await db
        .select()
        .from(session)
        .where(eq(session.token, token))
        .limit(1);

      if (sessionRecord.length === 0) {
        return null;
      }

      const sessionData = sessionRecord[0];

      // Check if session is expired
      if (new Date() > sessionData.expiresAt) {
        return null;
      }

      // Get user information
      const userRecord = await db
        .select()
        .from(user)
        .where(eq(user.id, sessionData.userId))
        .limit(1);

      if (userRecord.length === 0) {
        return null;
      }

      const userData = userRecord[0];

      return {
        user: {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          emailVerified: userData.emailVerified,
          image: userData.image,
        },
        session: {
          id: sessionData.id,
          token: sessionData.token,
          expiresAt: sessionData.expiresAt,
        },
      };
    } catch (error: unknown) {
      this.logger.error(`Failed to get session: ${String(error)}`);
      return null;
    }
  }

  /**
   * Sign out a user by invalidating their session
   */
  async signOut(token: string): Promise<boolean> {
    try {
      const result = await db
        .delete(session)
        .where(eq(session.token, token))
        .returning();

      return result.length > 0;
    } catch (error: unknown) {
      this.logger.error(`Failed to sign out: ${String(error)}`);
      return false;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<UserInfo | null> {
    try {
      const userRecord = await db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (userRecord.length === 0) {
        return null;
      }

      const userData = userRecord[0];

      return {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        emailVerified: userData.emailVerified,
        image: userData.image,
      };
    } catch (error: unknown) {
      this.logger.error(`Failed to get user: ${String(error)}`);
      return null;
    }
  }

  /**
   * Validate if a user is authenticated
   */
  async validateUser(token: string): Promise<UserInfo | null> {
    const sessionInfo = await this.getSession(token);
    return sessionInfo?.user || null;
  }
}
