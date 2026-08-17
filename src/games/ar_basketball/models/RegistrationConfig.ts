import { Document, Schema, Types, model } from "mongoose";
import "./Event";

export type PlayerMode = "guest" | "registered";
export type RegistrationFieldType = "text" | "email" | "phone" | "number" | "select";

export interface RegistrationField {
  key: string;
  label: string;
  type: RegistrationFieldType;
  required: boolean;
  options?: string[];
}

export interface RegistrationConfigDocument extends Document {
  eventId: Types.ObjectId;
  playerMode: PlayerMode;
  fields: RegistrationField[];
  // Both must match the `key` of a fields[] entry when non-null - enforced
  // in the validator/service layer (not the schema), since the check
  // depends on the sibling fields array. phoneFieldKey drives leaderboard
  // phone masking; nameFieldKey drives the leaderboard's display name
  // (fields are fully admin-defined per event, so neither can be assumed
  // to be a fixed key like "name"/"phone").
  phoneFieldKey: string | null;
  nameFieldKey: string | null;
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
    eventId: { type: Schema.Types.ObjectId, ref: "ArBasketballEvent", required: true, unique: true },
    playerMode: { type: String, required: true, enum: ["guest", "registered"] },
    fields: { type: [registrationFieldSchema], required: true, default: [] },
    phoneFieldKey: { type: String, default: null, trim: true },
    nameFieldKey: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

export const RegistrationConfig = model<RegistrationConfigDocument>(
  "ArBasketballRegistrationConfig",
  registrationConfigSchema,
  "ar_basketball_registration_configs"
);
