import { AppError } from "../../../core/utils/AppError";
import { Brand, BrandDocument } from "../models/Brand";
import { assertEventOwnedByOrg, bumpConfigVersion } from "./eventAccess";

export interface BrandPayload {
  id: string;
  name: string;
  logoUrl: string;
  displayOrder: number;
  enabled: boolean;
}

const toBrandPayload = (brand: BrandDocument): BrandPayload => ({
  id: brand._id.toString(),
  name: brand.name,
  logoUrl: brand.logoUrl,
  displayOrder: brand.displayOrder,
  enabled: brand.enabled,
});

export interface BrandInput {
  name: string;
  logoUrl: string;
  displayOrder: number;
  enabled?: boolean;
}

export const listBrands = async (
  organizationId: string,
  eventId: string
): Promise<BrandPayload[]> => {
  await assertEventOwnedByOrg(organizationId, eventId);
  const brands = await Brand.find({ eventId }).sort({ displayOrder: 1 });
  return brands.map(toBrandPayload);
};

export const createBrand = async (
  organizationId: string,
  eventId: string,
  input: BrandInput
): Promise<BrandPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);
  const brand = await Brand.create({ eventId, ...input });
  await bumpConfigVersion(eventId);
  return toBrandPayload(brand);
};

export const updateBrand = async (
  organizationId: string,
  eventId: string,
  brandId: string,
  input: Partial<BrandInput>
): Promise<BrandPayload> => {
  await assertEventOwnedByOrg(organizationId, eventId);
  const brand = await Brand.findOneAndUpdate({ _id: brandId, eventId }, { $set: input }, { new: true });
  if (!brand) {
    throw new AppError("Brand not found", 404);
  }
  await bumpConfigVersion(eventId);
  return toBrandPayload(brand);
};
