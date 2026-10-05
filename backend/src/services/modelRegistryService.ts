import { ModelMetadataModel, IModelMetadataDoc } from '../models/ModelMetadata.js'
import { AuditLog } from '../models/AuditLog.js'
import mongoose from 'mongoose'

export async function listAllModels(): Promise<IModelMetadataDoc[]> {
  return ModelMetadataModel.find().sort({ createdAt: -1 })
}

export async function getProductionModel(): Promise<IModelMetadataDoc | null> {
  return ModelMetadataModel.findOne({ status: 'PRODUCTION', isCurrent: true })
}

export async function promoteModel(
  modelVersion: string,
  userId?: string,
  userEmail?: string,
): Promise<IModelMetadataDoc> {
  const target = await ModelMetadataModel.findOne({ version: modelVersion })
  if (!target) {
    throw new Error(`Model version '${modelVersion}' not found in registry.`)
  }

  // 1. Demote any current production model to ARCHIVED
  const previousProd = await ModelMetadataModel.findOne({ status: 'PRODUCTION', isCurrent: true })
  if (previousProd && previousProd.version !== modelVersion) {
    previousProd.status = 'ARCHIVED'
    previousProd.isCurrent = false
    await previousProd.save()
  }

  // 2. Promote target model
  target.status = 'PRODUCTION'
  target.isCurrent = true
  target.promotedAt = new Date()
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    target.promotedBy = new mongoose.Types.ObjectId(userId)
  }
  await target.save()

  // 3. Log audit event
  await AuditLog.create({
    userId,
    userEmail: userEmail || 'system',
    action: 'PROMOTE_MODEL',
    resource: `Model:${modelVersion}`,
    details: {
      promotedVersion: modelVersion,
      previousVersion: previousProd?.version || null,
      metrics: target.metrics,
    },
    timestamp: new Date(),
  }).catch((err) => console.error('[Audit] Failed to log model promotion:', err))

  return target
}

export async function rollbackModel(
  targetVersion: string,
  reason: string,
  userId?: string,
  userEmail?: string,
): Promise<IModelMetadataDoc> {
  const target = await ModelMetadataModel.findOne({ version: targetVersion })
  if (!target) {
    throw new Error(`Target rollback version '${targetVersion}' not found.`)
  }

  const currentProd = await ModelMetadataModel.findOne({ status: 'PRODUCTION', isCurrent: true })
  const currentVersion = currentProd?.version || 'unknown'

  if (currentVersion === targetVersion) {
    throw new Error(`Model version '${targetVersion}' is already the active production model.`)
  }

  // Demote current
  if (currentProd) {
    currentProd.status = 'ARCHIVED'
    currentProd.isCurrent = false
    await currentProd.save()
  }

  // Promote target
  target.status = 'PRODUCTION'
  target.isCurrent = true
  target.rollbackHistory.push({
    fromVersion: currentVersion,
    toVersion: targetVersion,
    reason: reason || 'Manual administrative rollback',
    performedBy: userEmail || userId || 'admin',
    timestamp: new Date(),
  })
  await target.save()

  // Audit log
  await AuditLog.create({
    userId,
    userEmail: userEmail || 'system',
    action: 'ROLLBACK_MODEL',
    resource: `Model:${targetVersion}`,
    details: {
      fromVersion: currentVersion,
      toVersion: targetVersion,
      reason,
    },
    timestamp: new Date(),
  }).catch((err) => console.error('[Audit] Failed to log model rollback:', err))

  return target
}

export async function archiveModel(modelVersion: string): Promise<IModelMetadataDoc> {
  const model = await ModelMetadataModel.findOne({ version: modelVersion })
  if (!model) {
    throw new Error(`Model '${modelVersion}' not found.`)
  }
  if (model.status === 'PRODUCTION') {
    throw new Error('Cannot archive the active production model. Promote another model first.')
  }

  model.status = 'ARCHIVED'
  model.isCurrent = false
  await model.save()
  return model
}
