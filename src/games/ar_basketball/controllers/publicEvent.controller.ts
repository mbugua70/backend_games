import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import * as eventBrandingService from "../services/eventBranding.service";
import * as eventService from "../services/event.service";
import * as gameConfigService from "../services/gameConfig.service";
import * as leaderboardConfigService from "../services/leaderboardConfig.service";
import * as registrationConfigService from "../services/registrationConfig.service";
import { eventCodeParamSchema } from "../validators/publicGameParams.validator";

// Everything the mobile client needs to render registration/config/
// branding screens for an event, in one call - so it doesn't need many
// round trips before it can start rendering.
export const getEvent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { code } = eventCodeParamSchema.parse(req.params);
  const event = await eventService.getEventByCode(code);
  const [branding, registrationConfig, gameConfig, leaderboardConfig] = await Promise.all([
    eventBrandingService.getBrandingByEventId(event.id),
    registrationConfigService.getRegistrationConfigByEventId(event.id),
    gameConfigService.getGameConfigByEventId(event.id),
    leaderboardConfigService.getLeaderboardConfigByEventId(event.id),
  ]);
  sendSuccess(res, { event, branding, registrationConfig, gameConfig, leaderboardConfig });
});
