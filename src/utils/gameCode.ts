import { customAlphabet } from "nanoid";
import {
  GAME_CODE_ALPHABET,
  GAME_CODE_LENGTH,
  GAME_CODE_MAX_ATTEMPTS,
} from "../config/constants";
import { GameSession } from "../models/GameSession";
import { AppError } from "./AppError";

const generate = customAlphabet(GAME_CODE_ALPHABET, GAME_CODE_LENGTH);

export const generateGameCode = (): string => generate();

export const generateUniqueGameCode = async (): Promise<string> => {
  for (let attempt = 0; attempt < GAME_CODE_MAX_ATTEMPTS; attempt++) {
    const code = generateGameCode();
    const exists = await GameSession.exists({ gameCode: code });
    if (!exists) {
      return code;
    }
  }
  throw new AppError(
    "Failed to generate a unique game code, please try again",
    500
  );
};
