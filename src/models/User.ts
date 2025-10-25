// Mongoose model for storing user credentials
import mongoose, { Document, Schema } from 'mongoose';

export interface EncryptedPrivateKey {
  encrypted: string;
  iv: string;
  tag: string;
}

export interface IUser extends Document {
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  accountPublicKey: string; // Main wallet public key
  agentPrivateKey?: EncryptedPrivateKey; // Encrypted agent wallet private key
  agentPublicKey?: string; // Agent wallet public key (derived from private key)
  apiConfigKey?: string; // API Config Key from Pacifica dashboard (optional)
  createdAt: Date;
  updatedAt: Date;
  save(): Promise<this>;
}

const UserSchema: Schema = new Schema({
  telegramId: {
    type: Number,
    required: true,
    unique: true,
    index: true,
  },
  username: {
    type: String,
    default: null,
  },
  firstName: {
    type: String,
    default: null,
  },
  lastName: {
    type: String,
    default: null,
  },
  accountPublicKey: {
    type: String,
    required: true,
  },
    agentPrivateKey: {
      type: {
        encrypted: { type: String, required: true },
        iv: { type: String, required: true },
        tag: { type: String, required: true },
      },
      default: null,
    },
  agentPublicKey: {
    type: String,
    default: null,
  },
  apiConfigKey: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

// Don't expose sensitive data in JSON
UserSchema.methods.toJSON = function() {
  const obj = this.toObject();
  obj.agentPrivateKey = obj.agentPrivateKey ? '***' : undefined;
  return obj;
};

export const User = mongoose.model<IUser>('User', UserSchema);

