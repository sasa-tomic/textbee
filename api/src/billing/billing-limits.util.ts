/**
 * Self-hosting SMS limit configuration.
 *
 * The free/default tier limits are read from these env vars instead of the
 * MongoDB `plan` documents, so operators can cap (or uncap) usage without
 * touching the database. A value of -1 means "unlimited".
 *
 *   SMS_DAILY_LIMIT       max SMS per user per day      (default -1 = unlimited)
 *   SMS_MONTHLY_LIMIT     max SMS per user per month    (default -1 = unlimited)
 *   SMS_BULK_SEND_LIMIT   max recipients per bulk send  (default -1 = unlimited)
 *
 * When all three are unlimited the instance is in "self-host unlimited" mode:
 * no enforcement, no usage notifications, no upgrade nag emails.
 */

export interface SmsLimits {
  dailyLimit: number
  monthlyLimit: number
  bulkSendLimit: number
}

const UNLIMITED = -1

function parseLimit(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return UNLIMITED
  const parsed = parseInt(value, 10)
  // Treat anything non-numeric or <= 0 (other than not-set) as unlimited to
  // fail open rather than accidentally blocking a self-hosted instance.
  if (Number.isNaN(parsed) || parsed < 0) return UNLIMITED
  return parsed
}

export function getConfiguredSmsLimits(): SmsLimits {
  return {
    dailyLimit: parseLimit(process.env.SMS_DAILY_LIMIT),
    monthlyLimit: parseLimit(process.env.SMS_MONTHLY_LIMIT),
    bulkSendLimit: parseLimit(process.env.SMS_BULK_SEND_LIMIT),
  }
}

export function isUnlimitedSmsTier(): boolean {
  const limits = getConfiguredSmsLimits()
  return (
    limits.dailyLimit === UNLIMITED &&
    limits.monthlyLimit === UNLIMITED &&
    limits.bulkSendLimit === UNLIMITED
  )
}
