import { Request, Response } from 'express'
import { recordFootstep, FootstepInput, getLatestWaveform } from '../services/footstepService.js'
import { Footstep } from '../models/Footstep.js'

export async function postFootstep(req: Request, res: Response): Promise<void> {
  const deviceId = req.params.deviceId || req.body?.deviceId
  const {
    peakVoltage,
    averageVoltage,
    pulseDuration,
    stepInterval,
    storageVoltage,
    sequenceNumber,
    waveform,
    samplingRate,
    current,
    power,
    measuredEnergyJ,
    stepClass,
    confidence,
    timestamp,
  } = req.body

  if (
    typeof peakVoltage !== 'number' ||
    typeof averageVoltage !== 'number' ||
    typeof pulseDuration !== 'number' ||
    typeof storageVoltage !== 'number'
  ) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_FOOTSTEP_PAYLOAD',
        message: 'peakVoltage, averageVoltage, pulseDuration, and storageVoltage are required numbers.',
      },
    })
    return
  }

  try {
    const input: FootstepInput = {
      deviceId,
      timestamp,
      sequenceNumber: typeof sequenceNumber === 'number' ? sequenceNumber : null,
      peakVoltage,
      averageVoltage,
      pulseDuration,
      stepInterval: typeof stepInterval === 'number' ? stepInterval : 0,
      storageVoltage,
      waveform: Array.isArray(waveform) ? waveform : [],
      samplingRate: typeof samplingRate === 'number' ? samplingRate : 50,
      current: typeof current === 'number' ? current : null,
      power: typeof power === 'number' ? power : null,
      measuredEnergyJ: typeof measuredEnergyJ === 'number' ? measuredEnergyJ : null,
      stepClass,
      confidence,
    }

    const footstep = await recordFootstep(input)

    res.status(201).json({
      success: true,
      data: {
        id: footstep._id,
        deviceId: footstep.deviceId,
        sequenceNumber: footstep.sequenceNumber,
        timestamp: footstep.timestamp,
        stepClass: footstep.stepClass,
        confidence: footstep.confidence,
        predictionSource: footstep.predictionSource,
        estimatedEnergyJ: footstep.estimatedEnergyJ,
        measuredEnergyJ: footstep.measuredEnergyJ,
        waveformSamples: footstep.waveform.length,
      },
    })
  } catch (error) {
    console.error('[Footstep] Event processing error:', error)
    res.status(500).json({
      success: false,
      error: {
        code: 'FOOTSTEP_PROCESSING_ERROR',
        message: 'Failed to process footstep event.',
      },
    })
  }
}

export async function getWaveform(req: Request, res: Response): Promise<void> {
  const { footstepId } = req.params
  try {
    const footstep = await Footstep.findById(footstepId)
    if (!footstep) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Footstep event not found.' },
      })
      return
    }

    res.json({
      success: true,
      data: {
        footstepId: footstep._id,
        deviceId: footstep.deviceId,
        timestamp: footstep.timestamp,
        waveform: footstep.waveform,
        samplingRate: footstep.samplingRate,
        peakVoltage: footstep.features.peakVoltage,
        averageVoltage: footstep.features.averageVoltage,
        pulseDuration: footstep.features.pulseDuration,
        stepClass: footstep.stepClass,
        confidence: footstep.confidence,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'QUERY_ERROR', message: 'Failed to fetch footstep waveform.' },
    })
  }
}

export async function getLatestFootstepWaveform(req: Request, res: Response): Promise<void> {
  const deviceId = req.params.deviceId
  try {
    const latest = await getLatestWaveform(deviceId)
    res.json({
      success: true,
      data: latest,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'QUERY_ERROR', message: 'Failed to fetch latest waveform.' },
    })
  }
}
