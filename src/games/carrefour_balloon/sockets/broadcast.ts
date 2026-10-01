import { logger } from "../../../core/logger/logger";
import { Event } from "../models/Event";
import { GiftPool } from "../models/GiftPool";
import { buildPoolSnapshot } from "../services/poolSnapshot.service";
import { getIo } from "./ioRegistry";
import { CARREFOUR_BALLOON_NAMESPACE, poolRoom } from "./room";

// Called by win.service.ts after a committed win, and by every admin
// service that changes player-visible pool state (gift visibility/award/
// probability, stock adjustments, balloon settings). Recomputes the pool's
// current snapshot and pushes it to every socket watching that pool, so a
// second device playing the same brand/pool sees the new stock/odds without
// needing to re-fetch. A no-op if no socket server has been registered
// (e.g. during unit tests) or the pool no longer exists.
export const broadcastPoolUpdate = async (poolId: string): Promise<void> => {
  const io = getIo();
  if (!io) {
    return;
  }

  const pool = await GiftPool.findById(poolId);
  if (!pool) {
    return;
  }

  try {
    const [snapshot, event] = await Promise.all([buildPoolSnapshot(pool), Event.findById(pool.eventId)]);
    io.of(CARREFOUR_BALLOON_NAMESPACE)
      .to(poolRoom(poolId))
      .emit("game:pool-updated", {
        ...snapshot,
        configVersion: event?.configVersion ?? null,
        serverTime: new Date().toISOString(),
      });
  } catch (err) {
    // A broadcast failing should never fail the admin/win request that
    // triggered it - the REST response already reflects the new state, and
    // the next client fetch/join will pick it up regardless.
    logger.error({ err, poolId }, "Failed to broadcast carrefour_balloon pool update");
  }
};
