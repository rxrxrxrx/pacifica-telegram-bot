// Mongoose model for storing user credentials
import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  accountPublicKey: string; // Main wallet public key
  agentPrivateKey?: string; // Agent wallet private key (88 chars, for signing)
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
    type: String,
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

