/**
 * Generic cached async resolver for deduplicating concurrent requests
 * and caching results
 */

export class CachedAsyncResolver<TKey, TValue> {
  private cache = new Map<TKey, TValue>();
  private pending = new Map<TKey, Promise<TValue>>();

  /**
   * Resolves a value for the given key, using cache if available,
   * or deduplicating concurrent requests for the same key
   *
   * @param key - The key to resolve
   * @param resolver - Function to resolve the value if not cached
   * @returns The resolved value
   */
  async resolve(key: TKey, resolver: (key: TKey) => Promise<TValue>): Promise<TValue> {
    // Check cache first
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    // Check if already pending
    const pending = this.pending.get(key);
    if (pending) {
      return pending;
    }

    // Create new pending request
    const promise = this.executeResolver(key, resolver);
    this.pending.set(key, promise);

    try {
      const value = await promise;
      this.cache.set(key, value);
      return value;
    } finally {
      this.pending.delete(key);
    }
  }

  /**
   * Executes the resolver function with error handling
   */
  private async executeResolver(key: TKey, resolver: (key: TKey) => Promise<TValue>): Promise<TValue> {
    return await resolver(key);
  }

  /**
   * Checks if a key is cached
   */
  has(key: TKey): boolean {
    return this.cache.has(key);
  }

  /**
   * Gets a cached value without resolving
   */
  get(key: TKey): TValue | undefined {
    return this.cache.get(key);
  }

  /**
   * Sets a value in the cache
   */
  set(key: TKey, value: TValue): void {
    this.cache.set(key, value);
  }

  /**
   * Deletes a value from the cache
   */
  delete(key: TKey): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clears the entire cache
   */
  clear(): void {
    this.cache.clear();
    this.pending.clear();
  }

  /**
   * Gets the number of cached items
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Gets all cached keys
   */
  keys(): IterableIterator<TKey> {
    return this.cache.keys();
  }

  /**
   * Gets all cached values
   */
  values(): IterableIterator<TValue> {
    return this.cache.values();
  }

  /**
   * Gets all cached entries
   */
  entries(): IterableIterator<[TKey, TValue]> {
    return this.cache.entries();
  }

  /**
   * Resolves multiple keys in parallel
   */
  async resolveMany(keys: TKey[], resolver: (key: TKey) => Promise<TValue>): Promise<Map<TKey, TValue>> {
    const results = await Promise.all(
      keys.map(async (key) => {
        const value = await this.resolve(key, resolver);
        return [key, value] as [TKey, TValue];
      }),
    );

    return new Map(results);
  }

  /**
   * Preloads values into the cache
   */
  preload(entries: Iterable<[TKey, TValue]>): void {
    for (const [key, value] of entries) {
      this.cache.set(key, value);
    }
  }
}

/**
 * Creates a new cached async resolver
 */
export function createCachedResolver<TKey, TValue>(): CachedAsyncResolver<TKey, TValue> {
  return new CachedAsyncResolver<TKey, TValue>();
}
