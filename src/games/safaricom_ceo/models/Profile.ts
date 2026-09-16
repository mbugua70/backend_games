import { Document, Schema, Types, model } from "mongoose";
import "../../../core/models/Organization";

export interface ProfileDocument extends Document {
  organizationId: Types.ObjectId;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const profileSchema = new Schema<ProfileDocument>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    isActive: { type: Boolean, required: true, default: true },
    displayOrder: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

profileSchema.index({ organizationId: 1, code: 1 }, { unique: true });

// Historical SessionResult rows reference a profile by id (see
// SessionResult.ts) - profiles are deactivated (isActive: false) rather
// than deleted so those references always resolve, per CLAUDE.md's
// preference for deactivation over destructive deletes of historical data.
export const Profile = model<ProfileDocument>(
  "SafaricomCeoProfile",
  profileSchema,
  "safaricom_ceo_profiles"
);
