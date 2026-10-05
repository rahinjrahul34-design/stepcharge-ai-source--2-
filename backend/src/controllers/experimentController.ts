import { Request, Response } from 'express'
import {
  createExperimentSession,
  listExperimentSessions,
  getExperimentSession,
  updateExperimentStatus,
  getExperimentSamples,
  exportExperimentData,
  getDatasetQualityMetrics,
  compareExperiments,
  getStatisticalAnalysis,
  getCorrelationMatrix,
  generateResearchReport,
} from '../services/experimentService.js'
import { Device } from '../models/Device.js'

export async function createSessionHandler(req: Request, res: Response): Promise<void> {
  const { experimentName, participantId, deviceId, stepClass, targetSteps, notes } = req.body

  if (!experimentName || !participantId || !deviceId || !stepClass || !targetSteps) {
    res.status(400).json({
      success: false,
      error: { code: 'MISSING_FIELDS', message: 'experimentName, participantId, deviceId, stepClass, and targetSteps are required.' },
    })
    return
  }

  // Device ownership check
  const device = await Device.findOne({ deviceId: deviceId.trim() })
  if (!device) {
    res.status(404).json({ success: false, error: { code: 'DEVICE_NOT_FOUND', message: `Device '${deviceId}' not found.` } })
    return
  }

  if (req.user!.role !== 'ADMIN') {
    const isOwner = device.ownerId && device.ownerId.toString() === req.user!.userId
    if (!isOwner) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You can only create experiments on devices you own.' } })
      return
    }
  }

  try {
    const session = await createExperimentSession(
      {
        experimentName,
        participantId,
        deviceId,
        stepClass,
        targetSteps: parseInt(targetSteps, 10),
        notes,
      },
      req.user!.userId,
    )

    res.status(201).json({ success: true, data: session })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: { code: 'EXPERIMENT_CREATION_FAILED', message: error instanceof Error ? error.message : 'Failed to create experiment.' },
    })
  }
}

export async function listSessionsHandler(req: Request, res: Response): Promise<void> {
  const deviceId = req.query.deviceId as string | undefined
  try {
    const sessions = await listExperimentSessions(
      deviceId,
      req.user!.role === 'ADMIN' ? undefined : req.user!.userId,
    )
    res.json({ success: true, data: sessions })
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'QUERY_ERROR', message: 'Failed to list experiments.' } })
  }
}

export async function getSessionHandler(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params
  try {
    const session = await getExperimentSession(sessionId)
    if (!session) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Experiment session not found.' } })
      return
    }

    res.json({ success: true, data: session })
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'QUERY_ERROR', message: 'Failed to retrieve experiment.' } })
  }
}

export async function updateStatusHandler(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params
  const { status } = req.body

  if (!status || !['PLANNED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED'].includes(status)) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_STATUS', message: 'Valid status is PLANNED, RUNNING, PAUSED, COMPLETED, or CANCELLED.' },
    })
    return
  }

  try {
    const updated = await updateExperimentStatus(sessionId, status)
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: { code: 'STATUS_UPDATE_FAILED', message: error instanceof Error ? error.message : 'Failed to update experiment status.' },
    })
  }
}

export async function getSamplesHandler(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params
  try {
    const samples = await getExperimentSamples(sessionId)
    res.json({ success: true, data: samples })
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'QUERY_ERROR', message: 'Failed to fetch experiment samples.' } })
  }
}

export async function exportDataHandler(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params
  const format = (req.query.format as string) === 'csv' ? 'csv' : 'json'

  try {
    const data = await exportExperimentData(sessionId, format)
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="${sessionId}_dataset.csv"`)
      res.send(data)
      return
    }

    res.json({ success: true, data })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: { code: 'EXPORT_FAILED', message: error instanceof Error ? error.message : 'Failed to export experiment dataset.' },
    })
  }
}

export async function getDatasetQualityHandler(req: Request, res: Response): Promise<void> {
  try {
    const metrics = await getDatasetQualityMetrics()
    res.json({ success: true, data: metrics })
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'QUERY_ERROR', message: 'Failed to calculate dataset quality.' } })
  }
}

export async function compareExperimentsHandler(req: Request, res: Response): Promise<void> {
  const { sessionIds } = req.body
  if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
    res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'sessionIds array is required.' } })
    return
  }

  try {
    const comparison = await compareExperiments(sessionIds)
    res.json({ success: true, data: comparison })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'COMPARISON_ERROR', message: error.message } })
  }
}

export async function getStatisticalAnalysisHandler(req: Request, res: Response): Promise<void> {
  const stepClass = req.query.stepClass as string | undefined
  const sessionId = req.query.sessionId as string | undefined

  try {
    const stats = await getStatisticalAnalysis(stepClass, sessionId)
    res.json({ success: true, data: stats })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'STATS_ERROR', message: error.message } })
  }
}

export async function getCorrelationMatrixHandler(req: Request, res: Response): Promise<void> {
  const sessionId = req.query.sessionId as string | undefined

  try {
    const matrix = await getCorrelationMatrix(sessionId)
    res.json({ success: true, data: matrix })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'CORRELATION_ERROR', message: error.message } })
  }
}

export async function generateResearchReportHandler(req: Request, res: Response): Promise<void> {
  const sessionId = req.query.sessionId as string | undefined
  const deviceId = req.query.deviceId as string | undefined
  const format = req.query.format === 'json' ? 'json' : 'markdown'

  try {
    const report = await generateResearchReport(sessionId, deviceId)
    if (format === 'markdown') {
      res.setHeader('Content-Type', 'text/markdown')
      res.setHeader('Content-Disposition', 'attachment; filename="StepCharge_Research_Report.md"')
      res.send(report)
      return
    }
    res.json({ success: true, data: { report } })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message: error.message } })
  }
}
