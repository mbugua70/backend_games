import "../../../core/utils/cryptoPolyfill";
import bcrypt from "bcryptjs";
import { connectDatabase, disconnectDatabase } from "../../../core/config/database";
import { logger } from "../../../core/logger/logger";
import { Organization } from "../../../core/models/Organization";
import { Admin, AdminRole } from "../models/Admin";

const SALT_ROUNDS = 10;

interface ParsedArgs {
  org: string;
  orgName?: string;
  name: string;
  email: string;
  password: string;
  role: AdminRole;
}

const USAGE =
  "Usage: npm run seed:admin:safaricom_ceo -- --org <slug> [--org-name <name>] --name <name> --email <email> --password <password> [--role ADMIN|SUPER_ADMIN]";

const parseArgs = (): ParsedArgs => {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    return index === -1 ? undefined : args[index + 1];
  };

  const org = get("--org");
  const orgName = get("--org-name");
  const name = get("--name");
  const email = get("--email");
  const password = get("--password");
  const roleArg = get("--role");

  if (!org || !name || !email || !password) {
    throw new Error(USAGE);
  }
  if (roleArg !== undefined && roleArg !== "ADMIN" && roleArg !== "SUPER_ADMIN") {
    throw new Error(`--role must be ADMIN or SUPER_ADMIN, got "${roleArg}"`);
  }

  return {
    org,
    orgName,
    name,
    email,
    password,
    // Defaults to SUPER_ADMIN: the first admin seeded for a new org is the
    // one who needs to configure questions/profiles before the event can
    // run at all - see requireRole's SUPER_ADMIN gate on those routes.
    role: roleArg ?? "SUPER_ADMIN",
  };
};

const run = async (): Promise<void> => {
  const { org, orgName, name, email, password, role } = parseArgs();

  await connectDatabase();

  // Creates the organization on first use so onboarding a new client event
  // is just seeding its first admin, no separate provisioning step - same
  // pattern as jigsaw_puzzle/ar_basketball.
  const organization = await Organization.findOneAndUpdate(
    { slug: org },
    { $setOnInsert: { slug: org, name: orgName ?? org } },
    { upsert: true, new: true }
  );

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const admin = await Admin.findOneAndUpdate(
    { email: email.toLowerCase() },
    { name, passwordHash, role, organizationId: organization._id, isActive: true },
    { upsert: true, new: true }
  );

  logger.info(
    { email: admin.email, role: admin.role, organization: organization.slug },
    "Admin seeded"
  );
};

run()
  .catch((err: unknown) => {
    logger.error({ err }, "Failed to seed admin");
    process.exitCode = 1;
  })
  .finally(() => {
    void disconnectDatabase();
  });
