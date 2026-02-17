import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { StorageService } from './storage.service';

@Controller('v1/storage')
// @UseGuards(BetterAuthGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('signed-url')
  async getSignedUrl(@Body() body: any) {
    console.log('Received body:', body);
    const fileUrl = body?.fileUrl;
    if (!fileUrl) {
      return { error: 'fileUrl is required', received: body };
    }

    try {
      const key = this.storageService.extractKeyFromUrl(fileUrl);
      console.log('Extracted key:', key);
      const url = await this.storageService.getSignedDownloadUrl(key);
      return { url };
    } catch (error) {
      console.error('Error:', error.message);
      return { error: error.message };
    }
  }
}
