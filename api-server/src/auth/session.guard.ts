import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

interface RequestWithUser extends Request {
  user?: any;
}

@Injectable()
export class SessionGuard implements CanActivate {
  private readonly logger = new Logger(SessionGuard.name);

  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    try {
      const token = request.cookies?.['udayam.session_token'] as
        | string
        | undefined;

      if (!token) {
        this.logger.warn('No session token found in cookies');
        throw new UnauthorizedException('No session token found');
      }

      const session = await this.authService.getSession(token);

      if (!session) {
        this.logger.warn('Invalid or expired session');
        throw new UnauthorizedException('Invalid or expired session');
      }

      request.user = session.user;
      this.logger.debug(`User authenticated: ${session.user.email}`);

      return true;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Authentication failed: ${errorMessage}`);
      throw new UnauthorizedException('Authentication failed');
    }
  }
}
