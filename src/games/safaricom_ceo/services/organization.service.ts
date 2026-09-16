import { env } from "../../../core/config/env";
import { AppError } from "../../../core/utils/AppError";
import { Organization, OrganizationDocument } from "../../../core/models/Organization";

// safaricom_ceo's public endpoints (register/questions/sessions) carry no
// org identifier in their URLs, unlike jigsaw_puzzle/ar_basketball's
// per-event `code`. This resolves the single Organization that public
// traffic belongs to for this deployment - see env.ts's
// SAFARICOM_CEO_ORG_SLUG doc comment. Queried fresh each call (not cached)
// so a slug repointed at a different org, or deactivated, takes effect
// immediately without a process restart.
export const getPublicOrganization = async (): Promise<OrganizationDocument> => {
  const organization = await Organization.findOne({ slug: env.SAFARICOM_CEO_ORG_SLUG });
  if (!organization) {
    throw new AppError(
      `safaricom_ceo organization "${env.SAFARICOM_CEO_ORG_SLUG}" has not been seeded yet - run seed:admin:safaricom_ceo first`,
      503
    );
  }
  return organization;
};
