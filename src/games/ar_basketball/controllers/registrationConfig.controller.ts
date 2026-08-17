import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import { AdminTokenPayload } from "../middleware/requireAdmin";
import * as registrationConfigService from "../services/registrationConfig.service";
import {
  eventIdParamSchema,
  registrationConfigSchema,
} from "../validators/registrationConfig.validator";

const adminOf = (res: Response): AdminTokenPayload => res.locals.admin as AdminTokenPayload;

export const createRegistrationConfig = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { eventId } = eventIdParamSchema.parse(req.params);
    const input = registrationConfigSchema.parse(req.body);
    const config = await registrationConfigService.createRegistrationConfig(
      adminOf(res).organizationId,
      eventId,
      input
    );
    sendSuccess(res, config, "Registration config created", 201);
  }
);

export const getRegistrationConfig = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { eventId } = eventIdParamSchema.parse(req.params);
    const config = await registrationConfigService.getRegistrationConfigByEvent(
      adminOf(res).organizationId,
      eventId
    );
    sendSuccess(res, config);
  }
);

export const updateRegistrationConfig = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { eventId } = eventIdParamSchema.parse(req.params);
    const input = registrationConfigSchema.parse(req.body);
    const config = await registrationConfigService.updateRegistrationConfig(
      adminOf(res).organizationId,
      eventId,
      input
    );
    sendSuccess(res, config, "Registration config updated");
  }
);
