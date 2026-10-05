import mongoose, { Schema, Document } from 'mongoose'

export type UserRole = 'USER' | 'ADMIN'

export interface IUser extends Document {
  googleId: string
  email: string
  name: string
  avatarUrl?: string
  role: UserRole
  lastLoginAt: Date
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    googleId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['USER', 'ADMIN'],
      default: 'USER',
      index: true,
    },
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
)

export const User = mongoose.model<IUser>('User', UserSchema)
