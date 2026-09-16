import { Document, Schema, Types, model } from "mongoose";
import "../../../core/models/Organization";

export type AdminRole = "ADMIN" | "SUPER_ADMIN";

export interface AdminDocument extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: AdminRole;
  isActive: boolean;
  organizationId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const adminSchema = new Schema<AdminDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["ADMIN", "SUPER_ADMIN"], required: true, default: "ADMIN" },
    isActive: { type: Boolean, required: true, default: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
  },
  { timestamps: true }
);

// Model name is prefixed per game (not just "Admin") because mongoose's
// model registry is global to the process - an unprefixed name would
// collide if another game folder registers its own Admin model.
export const Admin = model<AdminDocument>(
  "SafaricomCeoAdmin",
  adminSchema,
  "safaricom_ceo_admins"
);
