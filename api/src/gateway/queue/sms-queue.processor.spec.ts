import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { Logger } from '@nestjs/common'
import * as firebaseAdmin from 'firebase-admin'
import { SmsQueueProcessor } from './sms-queue.processor'
import { Device } from '../schemas/device.schema'
import { SMS } from '../schemas/sms.schema'
import { SMSBatch } from '../schemas/sms-batch.schema'
import { WebhookService } from '../../webhook/webhook.service'

jest.mock('firebase-admin', () => ({
  messaging: jest.fn().mockReturnValue({ sendEach: jest.fn() }),
}))

describe('SmsQueueProcessor', () => {
  let processor: SmsQueueProcessor
  let warn: jest.SpyInstance

  const smsIds = ['sms-1', 'sms-2']
  const smsBatchId = 'batch-1'
  const deviceId = 'device-1'

  const mockSmsModel = {
    updateMany: jest.fn(),
    updateOne: jest.fn(),
    find: jest.fn(),
  }
  const mockSmsBatchModel = { findByIdAndUpdate: jest.fn() }
  const mockDeviceModel = { findById: jest.fn(), findByIdAndUpdate: jest.fn() }
  const mockWebhookService = { deliverNotification: jest.fn() }

  const job = (successes: boolean[]) => ({
    id: 'job-1',
    data: {
      deviceId,
      smsBatchId,
      fcmMessages: successes.map((_, i) => ({
        data: { smsData: JSON.stringify({ smsId: smsIds[i] }) },
      })),
    },
  })

  const fcmResponse = (successes: boolean[]) => ({
    responses: successes.map((success) =>
      success ? { success } : { success, error: { code: 'messaging/unregistered' } },
    ),
    successCount: successes.filter(Boolean).length,
    failureCount: successes.filter((s) => !s).length,
  })

  /** The filter passed to the dispatched-status updateMany, or null if it never ran. */
  const dispatchFilter = () => {
    const call = mockSmsModel.updateMany.mock.calls.find(
      ([, update]) => update?.$set?.status === 'dispatched',
    )
    return call ? call[0] : null
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsQueueProcessor,
        { provide: getModelToken(Device.name), useValue: mockDeviceModel },
        { provide: getModelToken(SMS.name), useValue: mockSmsModel },
        { provide: getModelToken(SMSBatch.name), useValue: mockSmsBatchModel },
        { provide: WebhookService, useValue: mockWebhookService },
      ],
    }).compile()

    processor = module.get<SmsQueueProcessor>(SmsQueueProcessor)

    mockDeviceModel.findById.mockReturnValue({
      populate: () => ({ exec: async () => ({ _id: deviceId, user: { _id: 'u1' } }) }),
    })
    mockDeviceModel.findByIdAndUpdate.mockReturnValue({ exec: async () => undefined })
    mockSmsBatchModel.findByIdAndUpdate.mockImplementation((_id, _u, options) =>
      options?.returnDocument
        ? { successCount: 2, failureCount: 0, recipientCount: 2 }
        : { exec: async () => undefined },
    )
    mockSmsModel.find.mockResolvedValue([])
    mockSmsModel.updateOne.mockResolvedValue({ modifiedCount: 1 })
    mockSmsModel.updateMany.mockResolvedValue({ modifiedCount: 2 })
  })

  afterEach(() => warn.mockRestore())

  it('only moves a row to dispatched while it is still pending', async () => {
    ;(firebaseAdmin.messaging().sendEach as jest.Mock).mockResolvedValue(
      fcmResponse([true, true]),
    )

    await processor.handleSendSms(job([true, true]) as any)

    // Without the precondition a fast handset's `sent` is dragged back down.
    expect(dispatchFilter()).toEqual({
      _id: { $in: smsIds },
      status: 'pending',
    })
  })

  it('reports the rows a fast handset had already moved past pending', async () => {
    ;(firebaseAdmin.messaging().sendEach as jest.Mock).mockResolvedValue(
      fcmResponse([true, true]),
    )
    mockSmsModel.updateMany.mockResolvedValue({ modifiedCount: 1 })

    await processor.handleSendSms(job([true, true]) as any)

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("1 of 2 dispatched row(s) had already moved past 'pending'"),
    )
  })

  it('stays quiet when every row was still pending', async () => {
    ;(firebaseAdmin.messaging().sendEach as jest.Mock).mockResolvedValue(
      fcmResponse([true, true]),
    )

    await processor.handleSendSms(job([true, true]) as any)

    expect(warn).not.toHaveBeenCalled()
  })

  it('marks a failed push without any status precondition', async () => {
    ;(firebaseAdmin.messaging().sendEach as jest.Mock).mockResolvedValue(
      fcmResponse([false, true]),
    )

    await processor.handleSendSms(job([false, true]) as any)

    // `failed` outranks every other status deliberately: a failure must never
    // be withheld because the row moved on.
    expect(mockSmsModel.updateOne).toHaveBeenCalledWith(
      { _id: smsIds[0] },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'failed' }) }),
    )
  })
})
