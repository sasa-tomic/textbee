import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { AppConfigController } from './app-config.controller'

/**
 * GET /config is the endpoint the Android app uses to initialize FCM at runtime. These tests pin the
 * contract: a complete `firebase` object when the FIREBASE_CLIENT_* env vars are set, and (the prod
 * failure mode) null fields when they aren't — so the app can tell the user exactly what's missing.
 */
describe('AppConfigController', () => {
  async function buildController(env: Record<string, string | undefined>) {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppConfigController],
      providers: [
        {
          provide: ConfigService,
          useValue: { get: (key: string) => env[key] },
        },
      ],
    }).compile()
    return module.get<AppConfigController>(AppConfigController)
  }

  it('returns a complete firebase config when FIREBASE_CLIENT_* are set', async () => {
    const controller = await buildController({
      FIREBASE_CLIENT_PROJECT_ID: 'voxtra-prod',
      FIREBASE_CLIENT_APP_ID: '1:1234567890:android:abcdef',
      FIREBASE_CLIENT_API_KEY: 'AIzaTestKey',
      FIREBASE_CLIENT_MESSAGING_SENDER_ID: '1234567890',
    })

    expect(controller.getPublicConfig()).toEqual({
      firebase: {
        projectId: 'voxtra-prod',
        applicationId: '1:1234567890:android:abcdef',
        apiKey: 'AIzaTestKey',
        messagingSenderId: '1234567890',
      },
    })
  })

  it('falls back to FIREBASE_PROJECT_ID for projectId when the client one is unset', async () => {
    const controller = await buildController({
      FIREBASE_PROJECT_ID: 'voxtra-prod',
      FIREBASE_CLIENT_APP_ID: '1:1234567890:android:abcdef',
      FIREBASE_CLIENT_API_KEY: 'AIzaTestKey',
      FIREBASE_CLIENT_MESSAGING_SENDER_ID: '1234567890',
    })

    expect(controller.getPublicConfig().firebase.projectId).toBe('voxtra-prod')
  })

  it('returns null client fields when FIREBASE_CLIENT_* are unset (the prod failure mode)', async () => {
    // Mirrors what prod currently serves: projectId set, but the app-facing client fields missing.
    const controller = await buildController({ FIREBASE_PROJECT_ID: 'voxtra-prod' })

    expect(controller.getPublicConfig()).toEqual({
      firebase: {
        projectId: 'voxtra-prod',
        applicationId: null,
        apiKey: null,
        messagingSenderId: null,
      },
    })
  })
})
