/** Cryptographically random integer in [0, max) */
export function randInt(max: number): number {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return arr[0]! % max
}

export function pick<T>(pool: readonly T[]): T {
  return pool[randInt(pool.length)]!
}
