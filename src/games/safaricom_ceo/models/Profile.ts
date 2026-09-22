import { Document, Schema, Types, model } from "mongoose";
import "../../../core/models/Organization";
import { Dimension, DIMENSIONS } from "./Question";

export interface ProfileNextFrontierEntry {
  dimension: Dimension;
  explanation: string;
}

export interface ProfileDocument extends Document {
  organizationId: Types.ObjectId;
  code: string;
  name: string;
  // Short one-liner shown directly under the profile-name badge on the
  // result screen (e.g. "Strong foundations. Opportunity to digitise and
  // connect.") - distinct from the longer `description` paragraph below it.
  tagline: string;
  description: string;
  // Fixed per-profile content (not computed per-session from the CEO's
  // actual answers): every CEO who lands on this profile sees the same
  // strengths list and the same 5-dimension next-frontier copy. See
  // profileResolver.service.ts, which only resolves profileCode/ceoQuestion
  // and no longer computes these two fields itself.
  strengths: Dimension[];
  nextFrontier: ProfileNextFrontierEntry[];
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const nextFrontierEntrySchema = new Schema<ProfileNextFrontierEntry>(
  {
    dimension: { type: String, enum: DIMENSIONS, required: true },
    explanation: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const profileSchema = new Schema<ProfileDocument>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    tagline: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    strengths: { type: [String], enum: DIMENSIONS, required: true },
    nextFrontier: { type: [nextFrontierEntrySchema], required: true },
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
