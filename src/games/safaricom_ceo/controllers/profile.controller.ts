import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import { AdminTokenPayload } from "../middleware/requireAdmin";
import * as profileService from "../services/profile.service";
import {
  createProfileSchema,
  profileIdParamSchema,
  updateProfileSchema,
} from "../validators/profile.validator";

const orgOf = (res: Response): string => (res.locals.admin as AdminTokenPayload).organizationId;

export const list = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const profiles = await profileService.listProfiles(orgOf(res));
  sendSuccess(res, profiles);
});

export const create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = createProfileSchema.parse(req.body);
  const profile = await profileService.createProfile(orgOf(res), input);
  sendSuccess(res, profile, "Profile created", 201);
});

export const update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { profileId } = profileIdParamSchema.parse(req.params);
  const input = updateProfileSchema.parse(req.body);
  const profile = await profileService.updateProfile(orgOf(res), profileId, input);
  sendSuccess(res, profile, "Profile updated");
});
