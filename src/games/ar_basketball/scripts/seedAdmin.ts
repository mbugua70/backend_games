import "../../../core/utils/cryptoPolyfill";
import bcrypt from "bcryptjs";
import { connectDatabase, disconnectDatabase } from "../../../core/config/database";
import { logger } from "../../../core/logger/logger";
import { Organization } from "../../../core/models/Organization";
import { Admin } from "../models/Admin";

const SALT_ROUNDS = 10;

interface ParsedArgs {
  org: string;
  orgName?: string;
  username: string;
  password: string;
}

const USAGE =
  "Usage: npm run seed:admin:ar_basketball -- --org <slug> [--org-name <name>] --username <username> --password <password>";

const parseArgs = (): ParsedArgs => {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    return index === -1 ? undefined : args[index + 1];
  };

  const org = get("--org");
  const orgName = get("--org-name");
  const username = get("--username");
  const password = get("--password");

  if (!org || !username || !password) {
    throw new Error(USAGE);
  }

  return { org, orgName, username, password };
};

const run = async (): Promise<void> => {
  const { org, orgName, username, password } = parseArgs();

  await connectDatabase();

  // Creates the organization on first use so a new client event doesn't
  // need a separate provisioning step - just seed its first admin.
  const organization = await Organization.findOneAndUpdate(
    { slug: org },
    { $setOnInsert: { slug: org, name: orgName ?? org } },
    { upsert: true, new: true }
  );

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const admin = await Admin.findOneAndUpdate(
    { username: username.toLowerCase() },
    { passwordHash, organizationId: organization._id },
    { upsert: true, new: true }
  );

  logger.info(
    { username: admin.username, organization: organization.slug },
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
