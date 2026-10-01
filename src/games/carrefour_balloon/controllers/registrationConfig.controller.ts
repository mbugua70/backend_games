import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import * as registrationConfigService from "../services/registrationConfig.service";
import { AdminTokenPayload } from "../middleware/requireAdmin";
import { eventIdParamSchema } from "../validators/common.validator";
import { updateRegistrationConfigSchema } from "../validators/registrationConfig.validator";

const orgId = (res: Response): string => (res.locals.admin as AdminTokenPayload).organizationId;

export const getOne = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId } = eventIdParamSchema.parse(req.params);
  const config = await registrationConfigService.getRegistrationConfig(orgId(res), eventId);
  sendSuccess(res, config);
});

export const upsert = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId } = eventIdParamSchema.parse(req.params);
  const input = updateRegistrationConfigSchema.parse(req.body);
  const config = await registrationConfigService.upsertRegistrationConfig(orgId(res), eventId, input);
  sendSuccess(res, config, "Registration config updated");
});
