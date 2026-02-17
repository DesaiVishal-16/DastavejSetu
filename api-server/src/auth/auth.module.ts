import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { BetterAuthGuard } from './better-auth.guard';
import { SessionGuard } from './session.guard';

@Module({
  imports: [ConfigModule],
  controllers: [AuthController],
  providers: [AuthService, BetterAuthGuard, SessionGuard],
  exports: [AuthService, BetterAuthGuard, SessionGuard],
})
export class AuthModule {}
