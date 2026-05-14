const auth = process.env.MAIL_USER
  ? { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
  : undefined

export const mailTransportConfig = {
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT ? parseInt(process.env.MAIL_PORT, 10) : 25,
  secure: false,
  ...(auth ? { auth } : {}),
}
