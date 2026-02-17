import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  HttpStatus,
  Req,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';

// Validation schemas
const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
});

interface RequestInfo {
  ipAddress?: string;
  userAgent?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Direct signup/login - creates user if doesn't exist, logs in if exists
   */
  @Post('signup')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async signup(
    @Body() body: unknown,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      // Validate input
      const validated = signupSchema.parse(body);

      const requestInfo: RequestInfo = {
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      };

      const result = await this.authService.signupOrLogin(
        validated.email,
        validated.name,
        requestInfo,
      );

      if (!result.success) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: result.message,
        });
      }

      // Set session cookie
      res.cookie('udayam.session_token', result.token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });

      return res.status(HttpStatus.OK).json({
        success: true,
        message: result.isNewUser
          ? 'Account created successfully'
          : 'Welcome back!',
        user: result.user,
      });
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Validation error',
          errors: err.issues,
        });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to create account',
      });
    }
  }

  /**
   * Login - for existing users
   */
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async login(
    @Body() body: unknown,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      // Validate input
      const validated = loginSchema.parse(body);

      const requestInfo: RequestInfo = {
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      };

      const result = await this.authService.login(validated.email, requestInfo);

      if (!result.success) {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          message: result.message,
        });
      }

      // Set session cookie
      res.cookie('udayam.session_token', result.token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });

      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Login successful',
        user: result.user,
      });
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Validation error',
          errors: err.issues,
        });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to login',
      });
    }
  }

  /**
   * Get current session information
   * Returns user info if authenticated, null otherwise
   */
  @Get('session')
  async getSession(@Req() req: Request, @Res() res: Response) {
    try {
      // Extract token from cookie
      const token = req.cookies?.['udayam.session_token'] as string | undefined;

      if (!token) {
        return res.status(HttpStatus.OK).json({
          success: true,
          data: null,
        });
      }

      const session = await this.authService.getSession(token);

      if (!session) {
        // Clear invalid cookie
        res.clearCookie('udayam.session_token', { path: '/' });
        return res.status(HttpStatus.OK).json({
          success: true,
          data: null,
        });
      }

      return res.status(HttpStatus.OK).json({
        success: true,
        data: {
          user: session.user,
          expiresAt: session.session.expiresAt,
        },
      });
    } catch {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to get session',
      });
    }
  }

  /**
   * Sign out the current user
   * Invalidates the session and clears the cookie
   */
  @Post('sign-out')
  async signOut(@Req() req: Request, @Res() res: Response) {
    try {
      const token = req.cookies?.['udayam.session_token'] as string | undefined;

      if (token) {
        await this.authService.signOut(token);
      }

      // Clear the cookie
      res.clearCookie('udayam.session_token', { path: '/' });

      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Signed out successfully',
      });
    } catch {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to sign out',
      });
    }
  }

  /**
   * Get current user profile
   */
  @Get('me')
  async getCurrentUser(@Req() req: Request, @Res() res: Response) {
    try {
      const token = req.cookies?.['udayam.session_token'] as string | undefined;

      if (!token) {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          message: 'Not authenticated',
        });
      }

      const session = await this.authService.getSession(token);

      if (!session) {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          message: 'Invalid or expired session',
        });
      }

      return res.status(HttpStatus.OK).json({
        success: true,
        data: session.user,
      });
    } catch {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to get user',
      });
    }
  }
}
