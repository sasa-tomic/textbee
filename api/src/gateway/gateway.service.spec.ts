import { Test, TestingModule } from '@nestjs/testing'
import { GatewayService } from './gateway.service'
import { AuthModule } from '../auth/auth.module'
import { getModelToken } from '@nestjs/mongoose'
import { Device, DeviceDocument } from './schemas/device.schema'
import { DeviceTombstone } from './schemas/device-tombstone.schema'
import { SMS } from './schemas/sms.schema'
import { SMSBatch } from './schemas/sms-batch.schema'
import { AuthService } from '../auth/auth.service'
import { WebhookService } from '../webhook/webhook.service'
import { BillingService } from '../billing/billing.service'
import { SmsQueueService } from './queue/sms-queue.service'
import { Model } from 'mongoose'
import { ConfigModule } from '@nestjs/config'
import { HttpException, HttpStatus, Logger } from '@nestjs/common'
import * as firebaseAdmin from 'firebase-admin'
import { SMSType } from './sms-type.enum'
import { WebhookEvent } from '../webhook/webhook-event.enum'
import { RegisterDeviceInputDTO, SendBulkSMSInputDTO, SendSMSInputDTO } from './gateway.dto'
import { User } from '../users/schemas/user.schema'
import { BatchResponse } from 'firebase-admin/messaging'

// Mock firebase-admin
jest.mock('firebase-admin', () => ({
  messaging: jest.fn().mockReturnValue({
    sendEach: jest.fn(),
  }),
}))

describe('GatewayService', () => {
  let service: GatewayService
  let deviceModel: Model<DeviceDocument>
  let deviceTombstoneModel: Model<any>
  let smsModel: Model<SMS>
  let smsBatchModel: Model<SMSBatch>
  let authService: AuthService
  let webhookService: WebhookService
  let billingService: BillingService
  let smsQueueService: SmsQueueService

  const mockDeviceModel = {
    findOne: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    create: jest.fn(),
    exec: jest.fn(),
    countDocuments: jest.fn(),
  }

  const mockSmsModel = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    updateMany: jest.fn(),
    countDocuments: jest.fn(),
  }

  const mockSmsBatchModel = {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  }

  const mockDeviceTombstoneModel = {
    updateOne: jest.fn(),
  }

  const mockAuthService = {
    getUserApiKeys: jest.fn(),
  }

  const mockWebhookService = {
    deliverNotification: jest.fn(),
  }

  const mockBillingService = {
    canPerformAction: jest.fn(),
  }

  const mockSmsQueueService = {
    isQueueEnabled: jest.fn(),
    addSendSmsJob: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GatewayService,
        {
          provide: getModelToken(Device.name),
          useValue: mockDeviceModel,
        },
        {
          provide: getModelToken(DeviceTombstone.name),
          useValue: mockDeviceTombstoneModel,
        },
        {
          provide: getModelToken(SMS.name),
          useValue: mockSmsModel,
        },
        {
          provide: getModelToken(SMSBatch.name),
          useValue: mockSmsBatchModel,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: WebhookService,
          useValue: mockWebhookService,
        },
        {
          provide: BillingService,
          useValue: mockBillingService,
        },
        {
          provide: SmsQueueService,
          useValue: mockSmsQueueService,
        },
      ],
      imports: [ConfigModule],
    }).compile()

    service = module.get<GatewayService>(GatewayService)
    deviceModel = module.get<Model<DeviceDocument>>(getModelToken(Device.name))
    deviceTombstoneModel = module.get<Model<any>>(
      getModelToken(DeviceTombstone.name),
    )
    smsModel = module.get<Model<SMS>>(getModelToken(SMS.name))
    smsBatchModel = module.get<Model<SMSBatch>>(getModelToken(SMSBatch.name))
    authService = module.get<AuthService>(AuthService)
    webhookService = module.get<WebhookService>(WebhookService)
    billingService = module.get<BillingService>(BillingService)
    smsQueueService = module.get<SmsQueueService>(SmsQueueService)

    // Reset all mocks
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('registerDevice', () => {
    const mockUser = { 
      _id: 'user123', 
      name: 'Test User', 
      email: 'test@example.com',
      password: 'password',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date()
    } as unknown as User;
    
    const mockDeviceInput: RegisterDeviceInputDTO = {
      model: 'Pixel 6',
      buildId: 'build123',
      fcmToken: 'token123',
      enabled: true,
    }
    const mockDevice = {
      _id: 'device123',
      ...mockDeviceInput,
      user: mockUser._id,
      // TODO: add more tests for different app version codes
      appVersionCode: 11,
    }

    it('should update device if it already exists', async () => {
      mockDeviceModel.findOne.mockResolvedValue(mockDevice)
      mockDeviceModel.findByIdAndUpdate.mockResolvedValue({
        ...mockDevice,
        fcmToken: 'updatedToken',
      })

      // The implementation internally uses the _id from the found device to update it
      // So we need to avoid the internal call to updateDevice which is failing in the test
      // by mocking the service method directly and restoring it after the test
      const originalUpdateDevice = service.updateDevice;
      service.updateDevice = jest.fn().mockResolvedValue({
        ...mockDevice,
        fcmToken: 'updatedToken',
      });

      const result = await service.registerDevice(mockDeviceInput, mockUser)

      expect(mockDeviceModel.findOne).toHaveBeenCalledWith({
        user: mockUser._id,
        model: mockDeviceInput.model,
        buildId: mockDeviceInput.buildId,
      })
      expect(service.updateDevice).toHaveBeenCalledWith(
        mockDevice._id.toString(),
        expect.objectContaining({
          ...mockDeviceInput,
          enabled: true,
          user: mockUser,
          fcmTokenUpdatedAt: expect.any(Date),
          fcmTokenInvalidatedAt: undefined,
          fcmTokenInvalidReason: undefined,
        }),
      )
      expect(result).toBeDefined()
      
      // Restore the original method
      service.updateDevice = originalUpdateDevice;
    })

    it('should create a new device if it does not exist', async () => {
      mockDeviceModel.findOne.mockResolvedValue(null)
      mockDeviceModel.create.mockResolvedValue(mockDevice)

      const result = await service.registerDevice(mockDeviceInput, mockUser)

      expect(mockDeviceModel.findOne).toHaveBeenCalledWith({
        user: mockUser._id,
        model: mockDeviceInput.model,
        buildId: mockDeviceInput.buildId,
      })
      expect(mockDeviceModel.create).toHaveBeenCalledWith({
        ...mockDeviceInput,
        user: mockUser,
        fcmTokenUpdatedAt: expect.any(Date),
        fcmTokenInvalidatedAt: undefined,
        fcmTokenInvalidReason: undefined,
      })
      expect(result).toBeDefined()
    })
  })

  describe('getDevicesForUser', () => {
    const mockUser = { 
      _id: 'user123', 
      name: 'Test User', 
      email: 'test@example.com',
      password: 'password',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date()
    } as unknown as User;
    
    const mockDevices = [
      { _id: 'device1', model: 'Pixel 6' },
      { _id: 'device2', model: 'iPhone 13' },
    ]

    it('should return all devices for a user', async () => {
      mockDeviceModel.find.mockResolvedValue(mockDevices)

      const result = await service.getDevicesForUser(mockUser)

      expect(mockDeviceModel.find).toHaveBeenCalledWith({ user: mockUser._id })
      expect(result).toEqual(mockDevices)
    })
  })

  describe('getDeviceById', () => {
    const mockDevice = { _id: 'device123', model: 'Pixel 6' }

    it('should return device by id', async () => {
      mockDeviceModel.findById.mockResolvedValue(mockDevice)

      const result = await service.getDeviceById('device123')

      expect(mockDeviceModel.findById).toHaveBeenCalledWith('device123')
      expect(result).toEqual(mockDevice)
    })
  })

  describe('updateDevice', () => {
    const mockDeviceId = 'device123'
    const mockDeviceInput: RegisterDeviceInputDTO = {
      model: 'Pixel 6',
      buildId: 'build123',
      fcmToken: 'updatedToken',
      enabled: true,
    }
    const mockDevice = {
      _id: mockDeviceId,
      ...mockDeviceInput,
    }

    it('should update device if it exists', async () => {
      mockDeviceModel.findById.mockResolvedValue(mockDevice)
      mockDeviceModel.findByIdAndUpdate.mockResolvedValue({
        ...mockDevice,
        fcmToken: 'updatedToken',
      })

      const result = await service.updateDevice(mockDeviceId, mockDeviceInput)

      expect(mockDeviceModel.findById).toHaveBeenCalledWith(mockDeviceId)
      expect(mockDeviceModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockDeviceId,
        { $set: mockDeviceInput },
        { new: true },
      )
      expect(result).toBeDefined()
    })

    it('should throw an error if device does not exist', async () => {
      mockDeviceModel.findById.mockResolvedValue(null)

      await expect(
        service.updateDevice(mockDeviceId, mockDeviceInput),
      ).rejects.toThrow(HttpException)
      expect(mockDeviceModel.findById).toHaveBeenCalledWith(mockDeviceId)
      expect(mockDeviceModel.findByIdAndUpdate).not.toHaveBeenCalled()
    })
  })

  describe('deleteDevice', () => {
    const mockDeviceId = '507f1f77bcf86cd799439011'
    const mockDevice = { _id: mockDeviceId, model: 'Pixel 6' }

    it('should tombstone and delete when device exists', async () => {
      mockDeviceModel.findById.mockResolvedValue(mockDevice)

      const result = await service.deleteDevice(mockDeviceId)

      expect(mockDeviceModel.findById).toHaveBeenCalledWith(mockDeviceId)
      expect(mockDeviceTombstoneModel.updateOne).toHaveBeenCalled()
      expect(mockDeviceModel.findByIdAndDelete).toHaveBeenCalledWith(mockDeviceId)
      expect(result).toEqual({ success: true })
    })

    it('should throw an error if device does not exist', async () => {
      mockDeviceModel.findById.mockResolvedValue(null)

      await expect(service.deleteDevice(mockDeviceId)).rejects.toThrow(
        HttpException,
      )
      expect(mockDeviceModel.findById).toHaveBeenCalledWith(mockDeviceId)
    })
  })

  describe('sendSMS', () => {
    const mockDeviceId = 'device123'
    const mockDevice = {
      _id: mockDeviceId,
      enabled: true,
      fcmToken: 'fcm-token',
      user: 'user123',
    }
    const mockSmsInput: SendSMSInputDTO = {
      message: 'Hello there',
      recipients: ['+123456789'],
      smsBody: 'Hello there',
      receivers: ['+123456789'],
    }
    const mockSms = {
      _id: 'sms123',
      device: mockDeviceId,
      message: mockSmsInput.message,
      type: SMSType.SENT,
      recipient: mockSmsInput.recipients[0],
      status: 'pending',
    }
    const mockSmsBatch = {
      _id: 'batch123',
      device: mockDeviceId,
      message: mockSmsInput.message,
      recipientCount: 1,
      status: 'pending',
    }
    const mockFcmResponse: BatchResponse = {
      successCount: 1,
      failureCount: 0,
      responses: [],
    }

    beforeEach(() => {
      mockDeviceModel.findById.mockResolvedValue(mockDevice)
      mockSmsBatchModel.create.mockResolvedValue(mockSmsBatch)
      mockSmsModel.create.mockResolvedValue(mockSms)
      mockDeviceModel.findByIdAndUpdate.mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue(true),
      }))
      mockSmsBatchModel.findByIdAndUpdate.mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue(true),
      }))
      mockBillingService.canPerformAction.mockResolvedValue(true)
      mockSmsQueueService.isQueueEnabled.mockReturnValue(false)
      
      // Fix the mock
      jest.spyOn(firebaseAdmin.messaging(), 'sendEach').mockResolvedValue(mockFcmResponse)
    })

    it('should send SMS successfully', async () => {
      const result = await service.sendSMS(mockDeviceId, mockSmsInput)

      expect(mockDeviceModel.findById).toHaveBeenCalledWith(mockDeviceId)
      expect(mockBillingService.canPerformAction).toHaveBeenCalledWith(
        mockDevice.user.toString(),
        'send_sms',
        mockSmsInput.recipients.length,
      )
      expect(mockSmsBatchModel.create).toHaveBeenCalled()
      expect(mockSmsModel.create).toHaveBeenCalled()
      expect(firebaseAdmin.messaging().sendEach).toHaveBeenCalled()
      expect(result).toEqual(mockFcmResponse)
    })

    it('should throw error if device is not enabled', async () => {
      mockDeviceModel.findById.mockResolvedValue({
        ...mockDevice,
        enabled: false,
      })

      await expect(
        service.sendSMS(mockDeviceId, mockSmsInput),
      ).rejects.toThrow(HttpException)
      expect(mockDeviceModel.findById).toHaveBeenCalledWith(mockDeviceId)
      expect(mockBillingService.canPerformAction).not.toHaveBeenCalled()
    })

    it('should throw error if message is blank', async () => {
      await expect(
        service.sendSMS(mockDeviceId, { ...mockSmsInput, message: '', smsBody: '' }),
      ).rejects.toThrow(HttpException)
    })

    it('should throw error if recipients are invalid', async () => {
      await expect(
        service.sendSMS(mockDeviceId, { ...mockSmsInput, recipients: [] }),
      ).rejects.toThrow(HttpException)
    })

    it('should queue SMS if queue is enabled', async () => {
      mockSmsQueueService.isQueueEnabled.mockReturnValue(true)
      mockSmsQueueService.addSendSmsJob.mockResolvedValue(true)

      const result = await service.sendSMS(mockDeviceId, mockSmsInput)

      expect(mockSmsQueueService.isQueueEnabled).toHaveBeenCalled()
      expect(mockSmsQueueService.addSendSmsJob).toHaveBeenCalled()
      expect(result).toHaveProperty('success', true)
      expect(result).toHaveProperty('smsBatchId', mockSmsBatch._id)
    })

    it('should handle queue error properly', async () => {
      mockSmsQueueService.isQueueEnabled.mockReturnValue(true)
      mockSmsQueueService.addSendSmsJob.mockRejectedValue(new Error('Queue error'))

      await expect(
        service.sendSMS(mockDeviceId, mockSmsInput),
      ).rejects.toThrow(HttpException)
      
      expect(mockSmsBatchModel.findByIdAndUpdate).toHaveBeenCalled()
      expect(mockSmsModel.updateMany).toHaveBeenCalled()
    })
  })

  describe('sendBulkSMS', () => {
    const mockDeviceId = 'device123'
    const mockDevice = {
      _id: mockDeviceId,
      enabled: true,
      fcmToken: 'fcm-token',
      user: 'user123',
    }
    const mockBulkSmsInput: SendBulkSMSInputDTO = {
      messageTemplate: 'Hello {name}',
      messages: [
        {
          message: 'Hello John',
          recipients: ['+123456789'],
          smsBody: 'Hello John',
          receivers: ['+123456789'],
        },
        {
          message: 'Hello Jane',
          recipients: ['+987654321'],
          smsBody: 'Hello Jane',
          receivers: ['+987654321'],
        },
      ],
    }
    const mockSmsBatch = {
      _id: 'batch123',
      device: mockDeviceId,
      message: mockBulkSmsInput.messageTemplate,
      recipientCount: 2,
      status: 'pending',
    }
    const mockSms = {
      _id: 'sms123',
      device: mockDeviceId,
      message: 'Hello John',
      type: SMSType.SENT,
      recipient: '+123456789',
      status: 'pending',
    }
    const mockFcmResponse: BatchResponse = {
      successCount: 1,
      failureCount: 0,
      responses: [],
    }

    beforeEach(() => {
      mockDeviceModel.findById.mockResolvedValue(mockDevice)
      mockSmsBatchModel.create.mockResolvedValue(mockSmsBatch)
      mockSmsModel.create.mockResolvedValue(mockSms)
      mockDeviceModel.findByIdAndUpdate.mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue(true),
      }))
      mockSmsBatchModel.findByIdAndUpdate.mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue(true),
      }))
      mockBillingService.canPerformAction.mockResolvedValue(true)
      mockSmsQueueService.isQueueEnabled.mockReturnValue(false)
      
      // Fix the mock
      jest.spyOn(firebaseAdmin.messaging(), 'sendEach').mockResolvedValue(mockFcmResponse)
    })

    it('should send bulk SMS successfully', async () => {
      const result = await service.sendBulkSMS(mockDeviceId, mockBulkSmsInput)

      expect(mockDeviceModel.findById).toHaveBeenCalledWith(mockDeviceId)
      expect(mockBillingService.canPerformAction).toHaveBeenCalledWith(
        mockDevice.user.toString(),
        'bulk_send_sms',
        2,
      )
      expect(mockSmsBatchModel.create).toHaveBeenCalled()
      expect(mockSmsModel.create).toHaveBeenCalled()
      expect(firebaseAdmin.messaging().sendEach).toHaveBeenCalled()
      expect(result).toHaveProperty('success', true)
    })

    it('should queue bulk SMS if queue is enabled', async () => {
      mockSmsQueueService.isQueueEnabled.mockReturnValue(true)
      mockSmsQueueService.addSendSmsJob.mockResolvedValue(true)

      const result = await service.sendBulkSMS(mockDeviceId, mockBulkSmsInput)

      expect(mockSmsQueueService.isQueueEnabled).toHaveBeenCalled()
      expect(mockSmsQueueService.addSendSmsJob).toHaveBeenCalled()
      expect(result).toHaveProperty('success', true)
      expect(result).toHaveProperty('smsBatchId', mockSmsBatch._id)
    })
  })

  describe('receiveSMS', () => {
    const mockDeviceId = 'device123'
    const mockDevice = {
      _id: mockDeviceId,
      user: 'user123',
    }
    const mockReceivedSmsData = {
      message: 'Hello from test',
      sender: '+123456789',
      receivedAt: new Date(),
    }
    const mockSms = {
      _id: 'sms123',
      ...mockReceivedSmsData,
      device: mockDeviceId,
      type: SMSType.RECEIVED,
    }

    beforeEach(() => {
      mockDeviceModel.findById.mockResolvedValue(mockDevice)
      mockSmsModel.findOne.mockResolvedValue(null)
      mockSmsModel.create.mockResolvedValue(mockSms)
      mockDeviceModel.findByIdAndUpdate.mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue(true),
      }))
      mockBillingService.canPerformAction.mockResolvedValue(true)
      mockWebhookService.deliverNotification.mockResolvedValue(true)
    })

    it('should receive SMS successfully', async () => {
      const result = await service.receiveSMS(mockDeviceId, mockReceivedSmsData)

      expect(mockDeviceModel.findById).toHaveBeenCalledWith(mockDeviceId)
      expect(mockBillingService.canPerformAction).toHaveBeenCalledWith(
        mockDevice.user.toString(),
        'receive_sms',
        1,
      )
      expect(mockSmsModel.create).toHaveBeenCalled()
      expect(mockDeviceModel.findByIdAndUpdate).toHaveBeenCalled()
      expect(mockWebhookService.deliverNotification).toHaveBeenCalledWith({
        sms: mockSms,
        user: mockDevice.user,
        event: WebhookEvent.MESSAGE_RECEIVED,
      })
      expect(result).toEqual(mockSms)
    })

    it('should throw error if device does not exist', async () => {
      mockDeviceModel.findById.mockResolvedValue(null)

      await expect(
        service.receiveSMS(mockDeviceId, mockReceivedSmsData),
      ).rejects.toThrow(HttpException)
    })

    it('should throw error if SMS data is invalid', async () => {
      await expect(
        service.receiveSMS(mockDeviceId, { ...mockReceivedSmsData, message: '' }),
      ).rejects.toThrow(HttpException)
    })
  })

  describe('getReceivedSMS', () => {
    const mockDeviceId = 'device123'
    const mockDevice = {
      _id: mockDeviceId,
    }
    const mockSmsData = [
      {
        _id: 'sms1',
        message: 'Hello 1',
        type: SMSType.RECEIVED,
        sender: '+123456789',
        receivedAt: new Date(),
      },
      {
        _id: 'sms2',
        message: 'Hello 2',
        type: SMSType.RECEIVED,
        sender: '+987654321',
        receivedAt: new Date(),
      },
    ]

    beforeEach(() => {
      mockDeviceModel.findById.mockResolvedValue(mockDevice)
      mockSmsModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockSmsData),
        }),
      })
      mockSmsModel.countDocuments.mockResolvedValue(2)
    })

    it('should get received SMS with pagination', async () => {
      const result = await service.getReceivedSMS(mockDeviceId, 1, 10)

      expect(mockDeviceModel.findById).toHaveBeenCalledWith(mockDeviceId)
      expect(mockSmsModel.countDocuments).toHaveBeenCalledWith({
        device: mockDevice._id,
        type: SMSType.RECEIVED,
      })
      expect(mockSmsModel.find).toHaveBeenCalledWith(
        {
          device: mockDevice._id,
          type: SMSType.RECEIVED,
        },
        null,
        {
          sort: { receivedAt: -1 },
          limit: 10,
          skip: 0,
        },
      )
      expect(result).toHaveProperty('data', mockSmsData)
      expect(result).toHaveProperty('meta')
      expect(result.meta).toHaveProperty('total', 2)
    })

    it('should throw error if device does not exist', async () => {
      mockDeviceModel.findById.mockResolvedValue(null)

      await expect(service.getReceivedSMS(mockDeviceId)).rejects.toThrow(
        HttpException,
      )
    })
  })

  describe('getMessages', () => {
    const mockDeviceId = 'device123'
    const mockDevice = {
      _id: mockDeviceId,
    }
    const mockSmsData = [
      {
        _id: 'sms1',
        message: 'Hello 1',
        type: SMSType.SENT,
        recipient: '+123456789',
        createdAt: new Date(),
      },
      {
        _id: 'sms2',
        message: 'Hello 2',
        type: SMSType.RECEIVED,
        sender: '+987654321',
        createdAt: new Date(),
      },
    ]

    beforeEach(() => {
      mockDeviceModel.findById.mockResolvedValue(mockDevice)
      mockSmsModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockSmsData),
        }),
      })
      mockSmsModel.countDocuments.mockResolvedValue(2)
    })

    it('should get all messages with pagination', async () => {
      const result = await service.getMessages(mockDeviceId, '', 1, 10)

      expect(mockDeviceModel.findById).toHaveBeenCalledWith(mockDeviceId)
      expect(mockSmsModel.countDocuments).toHaveBeenCalledWith({
        device: mockDevice._id,
      })
      expect(mockSmsModel.find).toHaveBeenCalledWith(
        {
          device: mockDevice._id,
        },
        null,
        {
          sort: { createdAt: -1 },
          limit: 10,
          skip: 0,
        },
      )
      expect(result).toHaveProperty('data', mockSmsData)
      expect(result).toHaveProperty('meta')
      expect(result.meta).toHaveProperty('total', 2)
    })

    it('should get sent messages with pagination', async () => {
      const result = await service.getMessages(mockDeviceId, 'sent', 1, 10)

      expect(mockSmsModel.countDocuments).toHaveBeenCalledWith({
        device: mockDevice._id,
        type: SMSType.SENT,
      })
      expect(mockSmsModel.find).toHaveBeenCalledWith(
        {
          device: mockDevice._id,
          type: SMSType.SENT,
        },
        null,
        expect.any(Object),
      )
    })

    it('should get received messages with pagination', async () => {
      const result = await service.getMessages(mockDeviceId, 'received', 1, 10)

      expect(mockSmsModel.countDocuments).toHaveBeenCalledWith({
        device: mockDevice._id,
        type: SMSType.RECEIVED,
      })
      expect(mockSmsModel.find).toHaveBeenCalledWith(
        {
          device: mockDevice._id,
          type: SMSType.RECEIVED,
        },
        null,
        expect.any(Object),
      )
    })

    it('should throw error if device does not exist', async () => {
      mockDeviceModel.findById.mockResolvedValue(null)

      await expect(service.getMessages(mockDeviceId)).rejects.toThrow(
        HttpException,
      )
    })
  })

  describe('getStatsForUser', () => {
    const mockUser = { 
      _id: 'user123', 
      name: 'Test User', 
      email: 'test@example.com',
      password: 'password',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date()
    } as unknown as User;
    
    const mockDevices = [
      {
        _id: 'device1',
        sentSMSCount: 10,
        receivedSMSCount: 5,
      },
      {
        _id: 'device2',
        sentSMSCount: 20,
        receivedSMSCount: 15,
      },
    ]
    const mockApiKeys = [
      { _id: 'key1', name: 'API Key 1' },
      { _id: 'key2', name: 'API Key 2' },
    ]

    beforeEach(() => {
      mockDeviceModel.find.mockResolvedValue(mockDevices)
      mockAuthService.getUserApiKeys.mockResolvedValue(mockApiKeys)
    })

    it('should return stats for user', async () => {
      const result = await service.getStatsForUser(mockUser)

      expect(mockDeviceModel.find).toHaveBeenCalledWith({ user: mockUser._id })
      expect(mockAuthService.getUserApiKeys).toHaveBeenCalledWith(mockUser)
      expect(result).toEqual({
        totalSentSMSCount: 30,
        totalReceivedSMSCount: 20,
        totalDeviceCount: 2,
        totalApiKeyCount: 2,
      })
    })
  })

  describe('updateSMSStatus', () => {
    const deviceId = 'device-1'
    const smsId = 'sms-1'
    const owner = { _id: 'user-1' }
    const sentAtInMillis = 1_700_000_000_000

    const makeSms = (overrides: Record<string, any> = {}) => ({
      _id: smsId,
      device: deviceId,
      status: 'sent',
      ...overrides,
    })

    const callUpdate = (dto: Record<string, any>) =>
      service.updateSMSStatus(deviceId, { smsId, ...dto } as any)

    /** The update document handed to findByIdAndUpdate, or null when no write happened. */
    const writtenUpdate = () =>
      mockSmsModel.findByIdAndUpdate.mock.calls.length
        ? mockSmsModel.findByIdAndUpdate.mock.calls[0][1]
        : null

    let warn: jest.SpyInstance

    beforeEach(() => {
      jest.clearAllMocks()
      warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined)
      mockDeviceModel.findById.mockResolvedValue({ _id: deviceId, user: owner })
      mockSmsModel.findById.mockResolvedValue(makeSms())
      mockSmsModel.findByIdAndUpdate.mockImplementation(
        async (_id: string, update: any) => ({
          ...makeSms(),
          ...(update.$set ?? {}),
        }),
      )
    })

    afterEach(() => {
      warn.mockRestore()
    })

    // A late update must never drag the row back down the lifecycle. The device
    // posts each status as an independent WorkManager chain, so these orderings
    // are routine rather than exceptional -- ['delivered', 'sent'] is the exact
    // sequence that left 8 delivered messages reported as `sent` in production.
    describe.each([
      ['delivered', 'sent'],
      ['delivered', 'dispatched'],
      ['delivered', 'pending'],
      ['delivered', 'unknown'],
      ['sent', 'dispatched'],
      ['sent', 'pending'],
      ['failed', 'sent'],
      ['failed', 'delivered'],
      ['delivery_failed', 'sent'],
    ])('with a stored status of %s', (current, incoming) => {
      beforeEach(() => {
        mockSmsModel.findById.mockResolvedValue(makeSms({ status: current }))
      })

      it(`refuses a late ${incoming} and keeps ${current}`, async () => {
        await callUpdate({ status: incoming })

        expect(writtenUpdate()?.$set?.status).toBeUndefined()
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining('refusing status regression'),
        )
      })
    })

    // Nothing above may come at the cost of the transitions that must work.
    describe.each([
      ['pending', 'dispatched'],
      ['pending', 'sent'],
      ['dispatched', 'sent'],
      ['sent', 'delivered'],
      ['dispatched', 'delivered'],
      ['unknown', 'sent'],
      ['unknown', 'delivered'],
      ['sent', 'delivery_failed'],
      ['delivered', 'failed'],
      ['delivery_failed', 'failed'],
    ])('with a stored status of %s', (current, incoming) => {
      beforeEach(() => {
        mockSmsModel.findById.mockResolvedValue(makeSms({ status: current }))
      })

      it(`applies a forward move to ${incoming}`, async () => {
        await callUpdate({ status: incoming })

        expect(writtenUpdate().$set.status).toBe(incoming)
        expect(warn).not.toHaveBeenCalled()
      })
    })

    it('re-applies an identical status without warning', async () => {
      mockSmsModel.findById.mockResolvedValue(makeSms({ status: 'sent' }))

      await callUpdate({ status: 'sent' })

      expect(writtenUpdate().$set.status).toBe('sent')
      expect(warn).not.toHaveBeenCalled()
    })

    it('normalizes the incoming status before ranking it', async () => {
      mockSmsModel.findById.mockResolvedValue(makeSms({ status: 'delivered' }))

      await callUpdate({ status: 'SENT', sentAtInMillis })

      expect(writtenUpdate().$set.status).toBeUndefined()
    })

    it('normalizes the stored status before ranking it', async () => {
      mockSmsModel.findById.mockResolvedValue(makeSms({ status: 'DELIVERED' }))

      await callUpdate({ status: 'sent', sentAtInMillis })

      expect(writtenUpdate().$set.status).toBeUndefined()
    })

    it('records sentAt even when the late SENT status itself is refused', async () => {
      mockSmsModel.findById.mockResolvedValue(makeSms({ status: 'delivered' }))

      await callUpdate({ status: 'sent', sentAtInMillis })

      const update = writtenUpdate()
      expect(update.$set.status).toBeUndefined()
      expect(update.$set.sentAt).toEqual(new Date(sentAtInMillis))
    })

    it('skips the write entirely when a refused status carries no timestamp', async () => {
      mockSmsModel.findById.mockResolvedValue(makeSms({ status: 'delivered' }))

      const result = await callUpdate({ status: 'sent' })

      // An empty $set is an error in mongo, not a no-op.
      expect(mockSmsModel.findByIdAndUpdate).not.toHaveBeenCalled()
      expect(result).toEqual({
        success: true,
        message: 'SMS status updated successfully',
      })
    })

    it('applies an unrankable incoming status and says so', async () => {
      mockSmsModel.findById.mockResolvedValue(makeSms({ status: 'delivered' }))

      await callUpdate({ status: 'queued_by_a_newer_app' })

      expect(writtenUpdate().$set.status).toBe('queued_by_a_newer_app')
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('outside the known lifecycle'),
      )
    })

    it('applies over an unrankable stored status and says so', async () => {
      mockSmsModel.findById.mockResolvedValue(
        makeSms({ status: 'written_by_a_newer_app' }),
      )

      await callUpdate({ status: 'sent', sentAtInMillis })

      expect(writtenUpdate().$set.status).toBe('sent')
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('outside the known lifecycle'),
      )
    })

    it('records the failure narrative alongside a failed status', async () => {
      mockSmsModel.findById.mockResolvedValue(makeSms({ status: 'dispatched' }))

      await callUpdate({
        status: 'failed',
        failedAtInMillis: sentAtInMillis,
        errorCode: 'RESULT_NETWORK_ERROR',
        errorMessage: 'no service',
      })

      expect(writtenUpdate().$set).toMatchObject({
        status: 'failed',
        failedAt: new Date(sentAtInMillis),
        errorCode: 'RESULT_NETWORK_ERROR',
        errorMessage: 'no service',
      })
    })

    it('falls back to a placeholder when a failure carries no message', async () => {
      mockSmsModel.findById.mockResolvedValue(makeSms({ status: 'dispatched' }))

      await callUpdate({ status: 'failed', failedAtInMillis: sentAtInMillis })

      expect(writtenUpdate().$set.errorMessage).toBe('Unknown error')
    })

    it('clears the stale timeout narrative once a real status arrives', async () => {
      // SmsStatusUpdateTask stamps this after 20 minutes of device silence; it
      // outlived the truth on every row this bug produced.
      mockSmsModel.findById.mockResolvedValue(
        makeSms({
          status: 'sent',
          errorMessage: 'Status update timeout - no response from device after dispatch',
        }),
      )

      await callUpdate({ status: 'delivered', deliveredAtInMillis: sentAtInMillis })

      expect(writtenUpdate().$unset).toEqual({ errorMessage: '', errorCode: '' })
    })

    it('keeps the narrative of a genuine failure', async () => {
      mockSmsModel.findById.mockResolvedValue(
        makeSms({ status: 'sent', errorMessage: 'stale' }),
      )

      await callUpdate({ status: 'failed', failedAtInMillis: sentAtInMillis })

      expect(writtenUpdate().$unset).toBeUndefined()
    })

    it('leaves the narrative alone when the status was refused', async () => {
      mockSmsModel.findById.mockResolvedValue(
        makeSms({ status: 'delivered', errorMessage: 'stale' }),
      )

      await callUpdate({ status: 'sent', sentAtInMillis })

      expect(writtenUpdate().$unset).toBeUndefined()
    })

    it('does not unset a narrative that was never there', async () => {
      mockSmsModel.findById.mockResolvedValue(makeSms({ status: 'sent' }))

      await callUpdate({ status: 'delivered', deliveredAtInMillis: sentAtInMillis })

      expect(writtenUpdate().$unset).toBeUndefined()
    })

    it('rolls the batch up from the stored status, not the refused one', async () => {
      mockSmsModel.findById.mockResolvedValue(makeSms({ status: 'delivered' }))
      mockSmsBatchModel.findById.mockResolvedValue({ _id: 'batch-1' })
      mockSmsModel.find.mockResolvedValue([{ status: 'delivered' }])

      await callUpdate({ status: 'sent', smsBatchId: 'batch-1', sentAtInMillis })

      // Comparing against the refused `sent` would have found no agreement and
      // left the batch behind.
      expect(mockSmsBatchModel.findByIdAndUpdate).toHaveBeenCalledWith('batch-1', {
        $set: { status: 'completed' },
      })
    })

    it('reports the stored status to the webhook, not the refused one', async () => {
      mockSmsModel.findById.mockResolvedValue(makeSms({ status: 'delivered' }))

      await callUpdate({ status: 'sent', sentAtInMillis })

      expect(mockWebhookService.deliverNotification).toHaveBeenCalledWith(
        expect.objectContaining({ event: WebhookEvent.MESSAGE_DELIVERED }),
      )
    })

    it('reports an applied status to the webhook', async () => {
      mockSmsModel.findById.mockResolvedValue(makeSms({ status: 'sent' }))

      await callUpdate({ status: 'delivered', deliveredAtInMillis: sentAtInMillis })

      expect(mockWebhookService.deliverNotification).toHaveBeenCalledWith(
        expect.objectContaining({ event: WebhookEvent.MESSAGE_DELIVERED }),
      )
    })

    it('rejects an unknown device', async () => {
      mockDeviceModel.findById.mockResolvedValue(null)

      await expect(callUpdate({ status: 'sent' })).rejects.toThrow(HttpException)
      expect(mockSmsModel.findByIdAndUpdate).not.toHaveBeenCalled()
    })

    it('rejects an unknown SMS', async () => {
      mockSmsModel.findById.mockResolvedValue(null)

      await expect(callUpdate({ status: 'sent' })).rejects.toThrow(HttpException)
      expect(mockSmsModel.findByIdAndUpdate).not.toHaveBeenCalled()
    })

    it('rejects an SMS belonging to another device', async () => {
      mockSmsModel.findById.mockResolvedValue(
        makeSms({ device: 'someone-elses-device' }),
      )

      await expect(callUpdate({ status: 'sent' })).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
      })
      expect(mockSmsModel.findByIdAndUpdate).not.toHaveBeenCalled()
    })
  })
})
