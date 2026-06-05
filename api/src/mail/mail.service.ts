import { ISendMailOptions, MailerService } from '@nest-modules/mailer'
import { Injectable, Logger } from '@nestjs/common'

export interface SendEmailResult {
  ok: boolean
  error?: string
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)

  constructor(private readonly mailerService: MailerService) {}

  async sendEmail({ to, subject, html, from }): Promise<SendEmailResult> {
    const sendMailOptions: ISendMailOptions = {
      to,
      subject,
      html,
    }

    if (from) {
      sendMailOptions['from'] = from
    }

    if (process.env.MAIL_REPLY_TO) {
      sendMailOptions['replyTo'] = process.env.MAIL_REPLY_TO
    }
    return this.deliver(sendMailOptions)
  }

  async sendEmailFromTemplate({
    to,
    cc,
    subject,
    template,
    context,
    from,
  }: ISendMailOptions): Promise<SendEmailResult> {
    const sendMailOptions: ISendMailOptions = {
      to,
      cc,
      subject,
      template,
      context,
    }

    if (from) {
      sendMailOptions['from'] = from
    }

    if (process.env.MAIL_REPLY_TO) {
      sendMailOptions['replyTo'] = process.env.MAIL_REPLY_TO
    }

    return this.deliver(sendMailOptions)
  }

  // Never throws: returns a result so callers can decide whether a failed
  // send should fail their request (e.g. password reset) or degrade
  // gracefully (e.g. a confirmation email for an already-saved record).
  private async deliver(
    sendMailOptions: ISendMailOptions,
  ): Promise<SendEmailResult> {
    try {
      await this.mailerService.sendMail(sendMailOptions)
      return { ok: true }
    } catch (e) {
      this.logger.error(
        `Failed to send email to ${sendMailOptions.to}: ${e?.message ?? e}`,
        e?.stack,
      )
      return { ok: false, error: e?.message ?? 'Unknown error' }
    }
  }
}
