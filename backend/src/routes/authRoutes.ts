import { Router } from 'express'
import {
  getAuthUrl,
  handleGoogleCallback,
  loginWithGoogleIdToken,
  getCurrentUser,
  logout,
  devLogin,
  registerWithEmail,
  loginWithEmail,
  requestPasswordReset,
  resetPassword,
} from '../controllers/authController.js'
import { requireAuth } from '../middlewares/auth.js'
import { authLimiter } from '../middlewares/rateLimiter.js'

const router = Router()

router.get('/google/url', getAuthUrl)
router.get('/google/callback', handleGoogleCallback)
router.post('/google/token', authLimiter, loginWithGoogleIdToken)
router.post('/register', authLimiter, registerWithEmail)
router.post('/login', authLimiter, loginWithEmail)
router.post('/forgot-password', authLimiter, requestPasswordReset)
router.post('/reset-password', authLimiter, resetPassword)
router.post('/dev-login', devLogin)
router.get('/me', requireAuth, getCurrentUser)
router.post('/logout', logout)

export default router
