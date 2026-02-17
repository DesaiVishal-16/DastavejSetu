import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { auth } from '../lib/auth';

interface RequestWithUser extends Request {
  user?: any;
}

@Injectable()
export class BetterAuthGuard implements CanActivate {
  private readonly logger = new Logger(BetterAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    try {
      // Convert Node.js headers to Web Headers API
      const headers = new Headers();
      Object.entries(request.headers).forEach(([key, value]) => {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach((v) => headers.append(key, v));
          } else {
            headers.set(key, value);
          }
        }
      });

      // Get the session from Better Auth
      const session = await auth.api.getSession({
        headers,
      });

      if (!session) {
        this.logger.warn('No valid session found');
        throw new UnauthorizedException('No valid session found');
      }

      // Attach user to request
      request.user = session.user;
      this.logger.debug(`User authenticated: ${session.user.email}`);

      return true;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Authentication failed: ${errorMessage}`);
      throw new UnauthorizedException('Authentication failed');
    }
  }
}
