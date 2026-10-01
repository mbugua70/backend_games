import { Document, Schema, Types, model } from "mongoose";
import "./Event";

export type RegistrationFieldType = "text" | "email" | "phone" | "number" | "select";

export interface RegistrationField {
  key: string;
  label: string;
  type: RegistrationFieldType;
  required: boolean;
  options?: string[];
}

// The field shape only - whether registration is required at all is
// Event.registrationEnabled (see Event.ts), so there's exactly one source
// of truth for that toggle.
export interface RegistrationConfigDocument extends Document {
  eventId: Types.ObjectId;
  fields: RegistrationField[];
  consentText: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const registrationFieldSchema = new Schema<RegistrationField>(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: ["text", "email", "phone", "number", "select"],
    },
    required: { type: Boolean, required: true, default: false },
    options: { type: [String], default: undefined },
  },
  { _id: false }
);

const registrationConfigSchema = new Schema<RegistrationConfigDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "CarrefourBalloonEvent", required: true, unique: true },
    fields: { type: [registrationFieldSchema], required: true, default: [] },
    consentText: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

export const RegistrationConfig = model<RegistrationConfigDocument>(
  "CarrefourBalloonRegistrationConfig",
  registrationConfigSchema,
  "carrefour_balloon_registration_configs"
);
