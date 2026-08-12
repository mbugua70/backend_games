import { Document, Schema, model } from "mongoose";

export interface OrganizationDocument extends Document {
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<OrganizationDocument>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  },
  { timestamps: true }
);

export const Organization = model<OrganizationDocument>(
  "Organization",
  organizationSchema,
  "organizations"
);
