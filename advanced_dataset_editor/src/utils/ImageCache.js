/**
 * LRU (Least Recently Used) Image Cache
 * Automatically manages memory by removing old images
 */
class LRUImageCache {
    constructor(maxSize = 100) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.hits = 0;
        this.misses = 0;
    }

    get(key) {
        if (!this.cache.has(key)) {
            this.misses++;
            return null;
        }

        this.hits++;

        // Move to end (most recently used)
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);

        return value;
    }

    set(key, value) {
        // Remove oldest if at capacity
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            const oldValue = this.cache.get(firstKey);

            // Cleanup blob URL to prevent memory leak
            if (oldValue?.startsWith('blob:')) {
                URL.revokeObjectURL(oldValue);
            }

            this.cache.delete(firstKey);
        }

        this.cache.set(key, value);
    }

    clear() {
        this.cache.forEach(value => {
            if (value?.startsWith('blob:')) {
                URL.revokeObjectURL(value);
            }
        });
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
    }

    has(key) {
        return this.cache.has(key);
    }

    size() {
        return this.cache.size;
    }

    getStats() {
        const total = this.hits + this.misses;
        const hitRate = total > 0 ? (this.hits / total * 100).toFixed(2) : 0;

        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hits: this.hits,
            misses: this.misses,
            hitRate: `${hitRate}%`
        };
    }
}

// Export singleton instances
export const imageCache = new LRUImageCache(100);  // Full-size images
export const thumbnailCache = new LRUImageCache(500);  // Thumbnails
