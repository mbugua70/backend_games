import { env } from "../../../core/config/env";
import { logger } from "../../../core/logger/logger";
import { AppError } from "../../../core/utils/AppError";
import { signToken } from "../../../core/utils/authToken";
import { PLAYER_TOKEN_TYPE, PlayerTokenPayload } from "../middleware/requirePlayer";
import { Player, PlayerDocument } from "../models/Player";
import { Session } from "../models/Session";
import { RegisterPlayerInput } from "../validators/player.validator";
import { getPublicOrganization } from "./organization.service";
import { normalizeKenyanPhone } from "./phone";

export const ALREADY_PLAYED_MESSAGE = "You have already played";

export interface RegisterPlayerResult {
  player: { id: string; name: string };
  token: string;
  wasCreated: boolean;
}

const isDuplicateKeyError = (err: unknown): boolean =>
  typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === 11000;

const issueToken = (player: PlayerDocument): string =>
  signToken(
    {
      playerId: player._id.toString(),
      organizationId: player.organizationId.toString(),
      type: PLAYER_TOKEN_TYPE,
    } satisfies PlayerTokenPayload,
    env.JWT_SECRET,
    env.SAFARICOM_TRIVIA_PLAYER_TOKEN_EXPIRES_IN
  );

// A phone that has already registered gets a fresh token back - unless
// its game is finished. That lets someone whose browser crashed (or who
// registered and walked off) come back and finish their one game, while
// still enforcing "each phone plays once": a completed session is final.
// The originally registered name is kept; a re-registration can't rename.
const resumeExisting = async (player: PlayerDocument): Promise<RegisterPlayerResult> => {
  const session = await Session.findOne({ playerId: player._id }).select("status");
  if (session?.status === "COMPLETED") {
    throw new AppError(ALREADY_PLAYED_MESSAGE, 409);
  }
  return {
    player: { id: player._id.toString(), name: player.name },
    token: issueToken(player),
    wasCreated: false,
  };
};

export const registerPlayer = async (input: RegisterPlayerInput): Promise<RegisterPlayerResult> => {
  const organization = await getPublicOrganization();
  const phone = normalizeKenyanPhone(input.phone);
  if (!phone) {
    throw new AppError("Please insert correct phone number", 400);
  }

  const existing = await Player.findOne({ organizationId: organization._id, phone });
  if (existing) {
    return resumeExisting(existing);
  }

  try {
    const player = await Player.create({ organizationId: organization._id, name: input.name, phone });
    logger.info({ playerId: player._id.toString() }, "safaricom_trivia player registered");
    return {
      player: { id: player._id.toString(), name: player.name },
      token: issueToken(player),
      wasCreated: true,
    };
  } catch (err) {
    // Lost a race with a simultaneous registration of the same phone (a
    // double-tapped submit) - converge on the row that won.
    if (isDuplicateKeyError(err)) {
      const winner = await Player.findOne({ organizationId: organization._id, phone });
      if (winner) {
        return resumeExisting(winner);
      }
    }
    throw err;
  }
};
