import {
  missingFirebaseClientConfig,
  firebaseClientConfigErrorMessage,
} from './firebase-client-config'

describe('missingFirebaseClientConfig', () => {
  const complete = {
    FIREBASE_CLIENT_APP_ID: '1:1234567890:android:abcdef',
    FIREBASE_CLIENT_API_KEY: 'AIzaTestKey',
    FIREBASE_CLIENT_MESSAGING_SENDER_ID: '1234567890',
    FIREBASE_CLIENT_PROJECT_ID: 'voxtra-prod',
  } as NodeJS.ProcessEnv

  it('returns [] when all client config is present', () => {
    expect(missingFirebaseClientConfig(complete)).toEqual([])
  })

  it('accepts FIREBASE_PROJECT_ID as the projectId fallback', () => {
    const { FIREBASE_CLIENT_PROJECT_ID: _omit, ...rest } = complete
    expect(
      missingFirebaseClientConfig({ ...rest, FIREBASE_PROJECT_ID: 'voxtra-prod' }),
    ).toEqual([])
  })

  it('flags every missing var when nothing is set', () => {
    expect(missingFirebaseClientConfig({})).toEqual([
      'FIREBASE_CLIENT_APP_ID',
      'FIREBASE_CLIENT_API_KEY',
      'FIREBASE_CLIENT_MESSAGING_SENDER_ID',
      'FIREBASE_CLIENT_PROJECT_ID (or FIREBASE_PROJECT_ID)',
    ])
  })

  it('treats blank/whitespace values as missing', () => {
    expect(
      missingFirebaseClientConfig({
        FIREBASE_CLIENT_APP_ID: '   ',
        FIREBASE_CLIENT_API_KEY: '',
        FIREBASE_CLIENT_MESSAGING_SENDER_ID: '1234567890',
        FIREBASE_PROJECT_ID: 'voxtra-prod',
      }),
    ).toEqual(['FIREBASE_CLIENT_APP_ID', 'FIREBASE_CLIENT_API_KEY'])
  })

  it('matches the current prod failure case (only FIREBASE_PROJECT_ID set)', () => {
    expect(
      missingFirebaseClientConfig({ FIREBASE_PROJECT_ID: 'voxtra-prod' }),
    ).toEqual([
      'FIREBASE_CLIENT_APP_ID',
      'FIREBASE_CLIENT_API_KEY',
      'FIREBASE_CLIENT_MESSAGING_SENDER_ID',
    ])
  })

  it('error message names the missing vars', () => {
    const msg = firebaseClientConfigErrorMessage(['FIREBASE_CLIENT_API_KEY'])
    expect(msg).toContain('Refusing to start')
    expect(msg).toContain('FIREBASE_CLIENT_API_KEY')
  })
})
