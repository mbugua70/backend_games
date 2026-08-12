const timers = new Map<string, NodeJS.Timeout>();

export const schedule = (
  gameCode: string,
  ms: number,
  callback: () => void
): void => {
  clear(gameCode);
  const handle = setTimeout(() => {
    timers.delete(gameCode);
    callback();
  }, ms);
  timers.set(gameCode, handle);
};

export const clear = (gameCode: string): void => {
  const existing = timers.get(gameCode);
  if (existing) {
    clearTimeout(existing);
    timers.delete(gameCode);
  }
};
