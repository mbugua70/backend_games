import "../utils/cryptoPolyfill";
import readline from "readline";
import bcrypt from "bcryptjs";
import { connectDatabase, disconnectDatabase } from "../config/database";
import { logger } from "../logger/logger";
import { Admin } from "../models/Admin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const SALT_ROUNDS = 12;

const KEY_ENTER = ["\n", "\r"];
const KEY_EOF = String.fromCharCode(4); // Ctrl+D
const KEY_INTERRUPT = String.fromCharCode(3); // Ctrl+C
const KEY_BACKSPACE = [String.fromCharCode(127), "\b"];

function promptVisible(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/** Reads a line from stdin without echoing it, masking each keystroke with '*' - there's no admin UI to create accounts, so this is the only place a password ever gets typed. */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.resume();
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");

    let value = "";
    const onData = (char: string): void => {
      if (KEY_ENTER.includes(char) || char === KEY_EOF) {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(value);
        return;
      }
      if (char === KEY_INTERRUPT) {
        process.stdout.write("\n");
        process.exit(130);
      }
      if (KEY_BACKSPACE.includes(char)) {
        if (value.length > 0) {
          value = value.slice(0, -1);
          process.stdout.write("\b \b");
        }
        return;
      }
      value += char;
      process.stdout.write("*");
    };
    stdin.on("data", onData);
  });
}

/** Non-interactive when ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD are set (e.g. scripted deploy), otherwise prompts. */
async function resolveCredentials(): Promise<{ email: string; password: string }> {
  const envEmail = process.env.ADMIN_SEED_EMAIL?.trim();
  const envPassword = process.env.ADMIN_SEED_PASSWORD;

  if (envEmail && envPassword) {
    return { email: envEmail, password: envPassword };
  }

  const email = await promptVisible("Admin email: ");
  const password = await promptHidden("Admin password: ");
  const confirm = await promptHidden("Confirm password: ");

  if (password !== confirm) {
    throw new Error("Passwords did not match");
  }

  return { email, password };
}

async function main(): Promise<void> {
  const { email, password } = await resolveCredentials();

  if (!EMAIL_RE.test(email)) {
    throw new Error(`"${email}" doesn't look like a valid email address`);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  await connectDatabase();

  const normalizedEmail = email.toLowerCase();
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Upsert by email: rerunning the script (same email) resets that admin's
  // password, a different email adds another admin. No HTTP route does this.
  await Admin.findOneAndUpdate(
    { email: normalizedEmail },
    { $set: { email: normalizedEmail, passwordHash } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  logger.info({ email: normalizedEmail }, "Admin account ready");
}

main()
  .catch((err: unknown) => {
    logger.error({ err }, "Failed to seed admin");
    process.exitCode = 1;
  })
  .finally(() => {
    void disconnectDatabase();
  });
