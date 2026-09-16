import { AppError } from "../../../core/utils/AppError";
import { Profile, ProfileDocument } from "../models/Profile";
import { CreateProfileInput, UpdateProfileInput } from "../validators/profile.validator";

export interface ProfilePayload {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const toProfilePayload = (profile: ProfileDocument): ProfilePayload => ({
  id: profile._id.toString(),
  code: profile.code,
  name: profile.name,
  description: profile.description,
  isActive: profile.isActive,
  displayOrder: profile.displayOrder,
  createdAt: profile.createdAt,
  updatedAt: profile.updatedAt,
});

const isDuplicateKeyError = (err: unknown): boolean =>
  typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === 11000;

export const listProfiles = async (organizationId: string): Promise<ProfilePayload[]> => {
  const profiles = await Profile.find({ organizationId }).sort({ displayOrder: 1 });
  return profiles.map(toProfilePayload);
};

export const createProfile = async (
  organizationId: string,
  input: CreateProfileInput
): Promise<ProfilePayload> => {
  try {
    const profile = await Profile.create({ organizationId, ...input });
    return toProfilePayload(profile);
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError(`Profile code "${input.code}" already exists for this organization`, 409);
    }
    throw err;
  }
};

// code is immutable once created: services/profileResolver.service.ts will
// eventually match on it once real business rules are approved, and a
// changed code would silently break any rule already keyed off the old
// value. isActive is how a profile is retired - see Profile.ts's doc
// comment on why it's never deleted once a SessionResult references it.
export const updateProfile = async (
  organizationId: string,
  profileId: string,
  input: UpdateProfileInput
): Promise<ProfilePayload> => {
  const profile = await Profile.findOneAndUpdate(
    { _id: profileId, organizationId },
    { $set: input },
    { new: true }
  );
  if (!profile) {
    throw new AppError("Profile not found", 404);
  }
  return toProfilePayload(profile);
};
