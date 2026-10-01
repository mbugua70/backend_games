import { Document, Schema, Types, model } from "mongoose";
import "./Event";

export interface ParticipantDocument extends Document {
  eventId: Types.ObjectId;
  // Keyed by the RegistrationConfig.fields[].key active for this event at
  // registration time - shape is admin-defined per event, so it can't be a
  // fixed set of typed columns.
  registrationData: Record<string, string>;
  consentAcceptedAt: Date | null;
  // Optional client-supplied Idempotency-Key header value, lets the
  // frontend safely retry a dropped registration response without creating
  // a duplicate participant.
  idempotencyKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const participantSchema = new Schema<ParticipantDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "CarrefourBalloonEvent", required: true },
    registrationData: { type: Schema.Types.Mixed, required: true, default: {} },
    consentAcceptedAt: { type: Date, default: null },
    idempotencyKey: { type: String, default: null },
  },
  { timestamps: true }
);

participantSchema.index({ eventId: 1, createdAt: -1 });
participantSchema.index(
  { eventId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

export const Participant = model<ParticipantDocument>(
  "CarrefourBalloonParticipant",
  participantSchema,
  "carrefour_balloon_participants"
);
