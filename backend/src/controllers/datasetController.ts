import { Request, Response } from 'express'
import {
  addDatasetSample,
  listDatasetSamples,
  deleteDatasetSample,
  exportDatasetToCsv,
} from '../services/datasetBackendService.js'
import { Device } from '../models/Device.js'
import { DatasetSample } from '../models/DatasetSample.js'

export async function addSample(req: Request, res: Response): Promise<void> {
  const user = req.user
  if (!user) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
    })
    return
  }

  const { sampleId, deviceId, participantId, features, label, source, note } = req.body

  if (!deviceId || !features || !label) {
    res.status(400).json({
      success: false,
      error: { code: 'MISSING_FIELDS', message: 'deviceId, features, and label are required.' },
    })
    return
  }

  try {
    // Phase 13: Verify device ownership
    const device = await Device.findOne({ deviceId: deviceId.trim() })
    if (!device) {
      res.status(404).json({
        success: false,
        error: { code: 'DEVICE_NOT_FOUND', message: `Device '${deviceId}' not found.` },
      })
      return
    }

    if (user.role !== 'ADMIN') {
      const isOwner = device.ownerId && device.ownerId.toString() === user.userId
      if (!isOwner) {
        res.status(403).json({
          success: false,
          error: { code: 'ACCESS_DENIED', message: 'You can only add dataset samples for devices you own.' },
        })
        return
      }
    }

    const sample = await addDatasetSample({
      sampleId,
      deviceId,
      participantId,
      features,
      label,
      source,
      note,
      userId: user.userId,
    })

    res.status(201).json({
      success: true,
      data: {
        id: sample.sampleId,
        timestamp: sample.timestamp.toISOString(),
        deviceId: sample.deviceId,
        participantId: sample.participantId,
        features: sample.features,
        label: sample.label,
        source: sample.source,
        note: sample.note,
      },
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'DATASET_ADD_FAILED',
        message: error instanceof Error ? error.message : 'Failed to save dataset sample.',
      },
    })
  }
}

export async function listSamples(req: Request, res: Response): Promise<void> {
  const user = req.user
  if (!user) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
    })
    return
  }

  const deviceId = req.query.deviceId as string | undefined

  try {
    if (deviceId) {
      const device = await Device.findOne({ deviceId: deviceId.trim() })
      if (!device) {
        res.status(404).json({
          success: false,
          error: { code: 'DEVICE_NOT_FOUND', message: `Device '${deviceId}' not found.` },
        })
        return
      }

      if (user.role !== 'ADMIN') {
        const isOwner = device.ownerId && device.ownerId.toString() === user.userId
        if (!isOwner) {
          res.status(403).json({
            success: false,
            error: { code: 'ACCESS_DENIED', message: 'You do not have permission to view samples for this device.' },
          })
          return
        }
      }
    }

    const samples = await listDatasetSamples(deviceId)
    res.json({
      success: true,
      data: samples.map((s) => ({
        id: s.sampleId,
        timestamp: s.timestamp.toISOString(),
        deviceId: s.deviceId,
        participantId: s.participantId,
        features: s.features,
        label: s.label,
        source: s.source,
        note: s.note,
      })),
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'QUERY_ERROR', message: 'Failed to list dataset samples.' },
    })
  }
}

export async function deleteSample(req: Request, res: Response): Promise<void> {
  const user = req.user
  if (!user) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
    })
    return
  }

  const sampleId = req.params.sampleId

  try {
    const sample = await DatasetSample.findOne({ sampleId })
    if (!sample) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Dataset sample not found.' },
      })
      return
    }

    // Phase 13: Verify sample creator or ADMIN role
    if (user.role !== 'ADMIN') {
      const isCreator = sample.createdBy && sample.createdBy.toString() === user.userId
      if (!isCreator) {
        res.status(403).json({
          success: false,
          error: { code: 'ACCESS_DENIED', message: 'You do not have permission to delete this sample.' },
        })
        return
      }
    }

    await deleteDatasetSample(sampleId)
    res.json({
      success: true,
      data: { message: `Sample ${sampleId} deleted.` },
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: { code: 'DELETE_ERROR', message: 'Failed to delete dataset sample.' },
    })
  }
}

export async function exportCsv(req: Request, res: Response): Promise<void> {
  const user = req.user
  if (!user) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
    })
    return
  }

  const deviceId = req.query.deviceId as string | undefined

  try {
    if (deviceId && user.role !== 'ADMIN') {
      const device = await Device.findOne({ deviceId: deviceId.trim() })
      if (!device || !device.ownerId || device.ownerId.toString() !== user.userId) {
        res.status(403).json({
          success: false,
          error: { code: 'ACCESS_DENIED', message: 'You do not have permission to export samples for this device.' },
        })
        return
      }
    }

    const samples = await listDatasetSamples(deviceId)
    const csv = exportDatasetToCsv(samples)
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="stepcharge-dataset.csv"')
    res.send(csv)
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'EXPORT_ERROR', message: 'Failed to export dataset CSV.' },
    })
  }
}
