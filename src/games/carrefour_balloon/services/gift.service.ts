import { AppError } from "../../../core/utils/AppError";
import { Gift, GiftDocument } from "../models/Gift";
import { assertEventOwnedByOrg, bumpConfigVersion } from "./eventAccess";

export interface GiftPayload {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  archived: boolean;
}

const toGiftPayload = (gift: GiftDocument): GiftPayload => ({
  id: gift._id.toString(),
  name: gift.name,
  description: gift.description,
  imageUrl: gift.imageUrl,
  archived: gift.archivedAt !== null,
});

export interface GiftInput {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
}

export const listGifts = async (
  organizationId: string,
  eventId: string,
  includeArchived: boolean
): Promise<GiftPayload[]> => {
  await assertEventOwnedByOrg(organizationId, eventId);
  const filter = includeArchived ? { eventId } : { eventId, archivedAt: null };
  const gifts = await Gift.find(filter).sort({ createdAt: -1 });
  return gifts.map(toGiftPayload);
};

export const createGift = async (
  organizationId: string,
  eventId: string,
  input: GiftInput
): Promise<GiftPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);
  const gift = await Gift.create({ eventId, ...input });
  await bumpConfigVersion(eventId);
  return toGiftPayload(gift);
};

export const updateGift = async (
  organizationId: string,
  eventId: string,
  giftId: string,
  input: Partial<GiftInput>
): Promise<GiftPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);
  const gift = await Gift.findOneAndUpdate({ _id: giftId, eventId }, { $set: input }, { new: true });
  if (!gift) {
    throw new AppError("Gift not found", 404);
  }
  await bumpConfigVersion(eventId);
  return toGiftPayload(gift);
};

// Soft delete only - preserves history on any WinningRecord that already
// snapshot this gift's name/image. An archived gift becomes ineligible
// (see probability.service.ts#isGiftEligible) without ever being removed.
export const archiveGift = async (
  organizationId: string,
  eventId: string,
  giftId: string
): Promise<GiftPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);
  const gift = await Gift.findOneAndUpdate(
    { _id: giftId, eventId },
    { $set: { archivedAt: new Date() } },
    { new: true }
  );
  if (!gift) {
    throw new AppError("Gift not found", 404);
  }
  await bumpConfigVersion(eventId);
  return toGiftPayload(gift);
};
