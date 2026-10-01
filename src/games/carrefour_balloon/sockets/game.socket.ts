import { Server, Socket } from "socket.io";
import { z } from "zod";
import { logger } from "../../../core/logger/logger";
import { Event } from "../models/Event";
import { resolveGiftPool } from "../services/giftPool.service";
import { getGameConfig } from "../services/gameConfig.service";
import { CARREFOUR_BALLOON_NAMESPACE, poolRoom } from "./room";

const joinSchema = z.object({
  eventId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid event id"),
  brandId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid brand id")
    .optional(),
});

// socket event -> Zod validate -> resolve -> join room -> ack with the
// same config payload REST returns (services/gameConfig.service.ts's
// single mapper), matching the "parallel path into the same service layer"
// principle root CLAUDE.md describes for this repo's sockets.
const handleJoin = async (
  socket: Socket,
  payload: unknown,
  ack?: (response: { ok: true; config: unknown } | { ok: false; error: string }) => void
): Promise<void> => {
  const parsed = joinSchema.safeParse(payload);
  if (!parsed.success) {
    ack?.({ ok: false, error: "Invalid game:join payload" });
    return;
  }
  const { eventId, brandId } = parsed.data;

  const event = await Event.findById(eventId);
  if (!event) {
    ack?.({ ok: false, error: "Event not found" });
    return;
  }

  const config = await getGameConfig(eventId, brandId ?? null);

  if (brandId) {
    const resolution = await resolveGiftPool(event, brandId);
    if (resolution.available) {
      await socket.join(poolRoom(resolution.pool._id.toString()));
    }
  }

  ack?.({ ok: true, config });
  socket.emit("game:config", config);
};

export const registerCarrefourBalloonSockets = (io: Server): void => {
  io.of(CARREFOUR_BALLOON_NAMESPACE).on("connection", (socket) => {
    socket.on("game:join", (payload, ack) => {
      handleJoin(socket, payload, ack).catch((err: unknown) => {
        logger.error({ err }, "carrefour_balloon game:join failed");
        ack?.({ ok: false, error: "Failed to join game" });
      });
    });
  });
};
