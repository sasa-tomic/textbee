import { Controller, Get } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiTags } from '@nestjs/swagger'

/**
 * Public, unauthenticated client configuration.
 *
 * Serves the (non-secret) Firebase client identifiers so the Android app can initialize
 * FCM at runtime instead of bundling a build-time google-services.json. These values are
 * public client identifiers (the Android API key is restricted by package + signing cert);
 * the real Firebase secret is the Admin service-account key, which is never exposed here.
 */
@ApiTags('config')
@Controller('config')
export class AppConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  getPublicConfig() {
    return {
      firebase: {
        projectId:
          this.configService.get<string>('FIREBASE_CLIENT_PROJECT_ID') ||
          this.configService.get<string>('FIREBASE_PROJECT_ID') ||
          null,
        applicationId:
          this.configService.get<string>('FIREBASE_CLIENT_APP_ID') || null,
        apiKey: this.configService.get<string>('FIREBASE_CLIENT_API_KEY') || null,
        messagingSenderId:
          this.configService.get<string>('FIREBASE_CLIENT_MESSAGING_SENDER_ID') ||
          null,
      },
    }
  }
}
