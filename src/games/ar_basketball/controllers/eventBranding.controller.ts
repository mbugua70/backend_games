import { Request, Response } from "express";
import { asyncHandler } from "../../../core/utils/asyncHandler";
import { sendSuccess } from "../../../core/utils/response";
import { AdminTokenPayload } from "../middleware/requireAdmin";
import * as eventBrandingService from "../services/eventBranding.service";
import { eventBrandingSchema, eventIdParamSchema } from "../validators/eventBranding.validator";

const adminOf = (res: Response): AdminTokenPayload => res.locals.admin as AdminTokenPayload;

export const createBranding = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId } = eventIdParamSchema.parse(req.params);
  const input = eventBrandingSchema.parse(req.body);
  const branding = await eventBrandingService.createBranding(
    adminOf(res).organizationId,
    eventId,
    input
  );
  sendSuccess(res, branding, "Branding created", 201);
});

export const getBranding = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId } = eventIdParamSchema.parse(req.params);
  const branding = await eventBrandingService.getBrandingByEvent(
    adminOf(res).organizationId,
    eventId
  );
  sendSuccess(res, branding);
});

export const updateBranding = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventId } = eventIdParamSchema.parse(req.params);
  const input = eventBrandingSchema.parse(req.body);
  const branding = await eventBrandingService.updateBranding(
    adminOf(res).organizationId,
    eventId,
    input
  );
  sendSuccess(res, branding, "Branding updated");
});
