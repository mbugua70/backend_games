import { Document, Schema, model } from "mongoose";

export interface OrganizationDocument extends Document {
  name: string;
  slug: string;
  // Generic client attributes any game may want (branding, account
  // status) - not specific to jigsaw_puzzle or any other single game.
  logoUrl: string | null;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<OrganizationDocument>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    logoUrl: { type: String, default: null, trim: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

export const Organization = model<OrganizationDocument>(
  "Organization",
  organizationSchema,
  "organizations"
);
