import { Request, Response, NextFunction } from 'express'
import { config } from '../config/env.js'

export interface AppError extends Error {
  statusCode?: number
  code?: string
  details?: unknown
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `The requested endpoint ${req.method} ${req.originalUrl} was not found on this server.`,
    },
  })
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode || 500
  const code = err.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST')
  const message =
    statusCode === 500 && config.isProd
      ? 'An unexpected server error occurred. Please try again later.'
      : err.message || 'An unexpected error occurred.'

  console.error(`[Error] [${code}] ${statusCode}:`, err)

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(config.isProd ? {} : { stack: err.stack, details: err.details }),
    },
  })
}
