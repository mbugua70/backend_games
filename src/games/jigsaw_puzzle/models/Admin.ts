import { Document, Schema, Types, model } from "mongoose";
import "../../../core/models/Organization";

export interface AdminDocument extends Document {
  username: string;
  passwordHash: string;
  organizationId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const adminSchema = new Schema<AdminDocument>(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
  },
  { timestamps: true }
);

// Model name is prefixed per game (not just "Admin") because mongoose's
// model registry is global to the process - if another game folder ever
// registers its own Admin model, an unprefixed name would collide.
export const Admin = model<AdminDocument>(
  "JigsawPuzzleAdmin",
  adminSchema,
  "jigsaw_puzzle_admins"
);
