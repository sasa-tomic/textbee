const auth = process.env.MAIL_USER
  ? { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
  : undefined

export const mailTransportConfig = {
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT ? parseInt(process.env.MAIL_PORT, 10) : 25,
  secure: false,
  // Skip STARTTLS when MAIL_IGNORE_TLS=true. Needed for LAN relays whose
  // TLS cert covers only a public hostname — connecting by RFC1918 IP
  // fails cert verification on STARTTLS upgrade. Plain SMTP is fine inside
  // the LAN trust boundary.
  ignoreTLS: process.env.MAIL_IGNORE_TLS === 'true',
  // Force STARTTLS when MAIL_REQUIRE_TLS=true. Use for public relays that
  // mandate an encrypted upgrade; nodemailer aborts if STARTTLS is refused.
  requireTLS: process.env.MAIL_REQUIRE_TLS === 'true',
  ...(auth ? { auth } : {}),
}
