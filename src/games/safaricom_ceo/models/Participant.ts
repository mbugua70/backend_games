import { Document, Schema, Types, model } from "mongoose";
import "../../../core/models/Organization";

// PII (phoneNumber, email) - never log full documents of this model. See
// services/participant.service.ts for the log-redaction discipline this
// model's callers must follow.
export interface ParticipantDocument extends Document {
  organizationId: Types.ObjectId;
  // The only required field on registration - everything else below is
  // optional so the form can be filled in partially at a busy event.
  name: string;
  phoneNumber: string | null;
  businessName: string | null;
  email: string | null;
  businessType: string | null;
  numberOfEmployees: string | null;
  // Optional client-supplied Idempotency-Key header value. A retry of the
  // same registration submit (e.g. after a dropped response at a busy
  // event) returns the original participant instead of creating a
  // duplicate. Sparse + scoped per org so participants that never sent one
  // don't collide on a shared null value.
  idempotencyKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const participantSchema = new Schema<ParticipantDocument>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    name: { type: String, required: true, trim: true },
    phoneNumber: { type: String, default: null, trim: true },
    businessName: { type: String, default: null, trim: true },
    email: { type: String, default: null, trim: true, lowercase: true },
    businessType: { type: String, default: null, trim: true },
    numberOfEmployees: { type: String, default: null, trim: true },
    idempotencyKey: { type: String, default: null },
  },
  { timestamps: true }
);

participantSchema.index({ organizationId: 1, createdAt: -1 });
participantSchema.index({ organizationId: 1, businessType: 1 });
participantSchema.index({ organizationId: 1, numberOfEmployees: 1 });
participantSchema.index(
  { organizationId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

export const Participant = model<ParticipantDocument>(
  "SafaricomCeoParticipant",
  participantSchema,
  "safaricom_ceo_participants"
);
