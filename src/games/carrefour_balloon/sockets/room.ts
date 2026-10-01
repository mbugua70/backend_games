// This game's own Socket.IO namespace - keeps its rooms/events isolated
// from any other game that registers sockets onto the same shared
// server.ts Socket.IO instance.
export const CARREFOUR_BALLOON_NAMESPACE = "/carrefour_balloon";

// One room per gift pool (not per brand) - in shared mode every brand's
// players are already in the same pool and should see the same stock
// update; in perBrand mode each brand's pool is its own room anyway since
// each brand has its own pool document.
export const poolRoom = (poolId: string): string => `carrefour_balloon:pool:${poolId}`;
