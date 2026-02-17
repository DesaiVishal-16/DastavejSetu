import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ExtractionController } from './extraction.controller';
import { ExtractionService } from './extraction.service';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 60000,
      maxRedirects: 5,
    }),
    AuthModule,
    StorageModule,
  ],
  controllers: [ExtractionController],
  providers: [ExtractionService],
  exports: [ExtractionService],
})
export class ExtractionModule {}
