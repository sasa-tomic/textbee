import { Test, TestingModule } from '@nestjs/testing'
import { MailerService } from '@nest-modules/mailer'
import { MailService } from './mail.service'

describe('MailService', () => {
  let service: MailService
  let mailerService: { sendMail: jest.Mock }

  beforeEach(async () => {
    mailerService = { sendMail: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: MailerService,
          useValue: mailerService,
        },
      ],
    }).compile()

    service = module.get<MailService>(MailService)
    // Silence the error logger during the failure-path tests.
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete process.env.MAIL_REPLY_TO
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('sendEmailFromTemplate', () => {
    const payload = {
      to: 'user@example.com',
      subject: 'Hello',
      template: 'welcome',
      context: { name: 'User' },
    }

    it('returns ok: true when the underlying transport succeeds', async () => {
      mailerService.sendMail.mockResolvedValue({ messageId: 'abc' })

      const result = await service.sendEmailFromTemplate(payload)

      expect(result).toEqual({ ok: true })
      expect(mailerService.sendMail).toHaveBeenCalledTimes(1)
    })

    it('returns ok: false with the error message instead of throwing on failure', async () => {
      mailerService.sendMail.mockRejectedValue(
        Object.assign(new Error('Invalid login: 535 5.7.8 Permission denied'), {
          code: 'EAUTH',
        }),
      )

      const result = await service.sendEmailFromTemplate(payload)

      expect(result.ok).toBe(false)
      expect(result.error).toContain('535 5.7.8 Permission denied')
    })

    it('includes replyTo only when MAIL_REPLY_TO is set', async () => {
      mailerService.sendMail.mockResolvedValue({})
      process.env.MAIL_REPLY_TO = 'reply@example.com'

      await service.sendEmailFromTemplate(payload)

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ replyTo: 'reply@example.com' }),
      )
    })
  })

  describe('sendEmail', () => {
    const payload = {
      to: 'user@example.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
      from: undefined,
    }

    it('returns ok: true on success', async () => {
      mailerService.sendMail.mockResolvedValue({})

      await expect(service.sendEmail(payload)).resolves.toEqual({ ok: true })
    })

    it('returns ok: false on failure without throwing', async () => {
      mailerService.sendMail.mockRejectedValue(new Error('connection refused'))

      const result = await service.sendEmail(payload)

      expect(result.ok).toBe(false)
      expect(result.error).toBe('connection refused')
    })
  })
})
