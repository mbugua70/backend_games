import { Document, Schema, Types, model } from "mongoose";
import "./Event";

export interface EventBrandingDocument extends Document {
  eventId: Types.ObjectId;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  backgroundImageUrl: string | null;
  sponsorLogoUrls: string[];
  createdAt: Date;
  updatedAt: Date;
}

const eventBrandingSchema = new Schema<EventBrandingDocument>(
  {
    // unique -> one branding doc per event, enforced at the DB level too,
    // not just in the service layer's create check.
    eventId: { type: Schema.Types.ObjectId, ref: "ArBasketballEvent", required: true, unique: true },
    logoUrl: { type: String, default: null, trim: true },
    primaryColor: { type: String, default: null, trim: true },
    secondaryColor: { type: String, default: null, trim: true },
    backgroundImageUrl: { type: String, default: null, trim: true },
    sponsorLogoUrls: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const EventBranding = model<EventBrandingDocument>(
  "ArBasketballEventBranding",
  eventBrandingSchema,
  "ar_basketball_event_brandings"
);
