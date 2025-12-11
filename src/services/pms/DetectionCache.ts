/**
 * Cache LRU pour la détection PMS et les patterns
 * Évite les recalculs coûteux
 */

import { PmsDetectionResult, ExtractedRoom } from './types';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hits: number;
}

interface DetectionCacheEntry extends CacheEntry<PmsDetectionResult> {}

interface PatternCacheEntry extends CacheEntry<ExtractedRoom[]> {
  hotelId: string;
}

class DetectionCache {
  private detectionCache = new Map<string, DetectionCacheEntry>();
  private patternCache = new Map<string, PatternCacheEntry>();
  private maxDetectionCacheSize = 100;
  private maxPatternCacheSize = 50;
  private ttlMs = 5 * 60 * 1000; // 5 minutes

  /**
   * Génère une clé de cache à partir du texte
   */
  private generateKey(text: string): string {
    // Utiliser les premiers caractères + longueur + hash simple
    const prefix = text.substring(0, 200).replace(/\s+/g, ' ');
    const length = text.length;
    // Hash simple basé sur quelques caractères répartis dans le texte
    let hash = 0;
    const step = Math.max(1, Math.floor(text.length / 20));
    for (let i = 0; i < text.length; i += step) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    return `${prefix}_${length}_${hash}`;
  }

  /**
   * Récupère un résultat de détection du cache
   */
  getDetection(text: string): PmsDetectionResult | null {
    const key = this.generateKey(text);
    const entry = this.detectionCache.get(key);
    
    if (!entry) return null;
    
    // Vérifier le TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.detectionCache.delete(key);
      return null;
    }
    
    entry.hits++;
    return entry.value;
  }

  /**
   * Stocke un résultat de détection
   */
  setDetection(text: string, result: PmsDetectionResult): void {
    const key = this.generateKey(text);
    
    // Éviction LRU si nécessaire
    if (this.detectionCache.size >= this.maxDetectionCacheSize) {
      this.evictLRU(this.detectionCache);
    }
    
    this.detectionCache.set(key, {
      value: result,
      timestamp: Date.now(),
      hits: 0
    });
  }

  /**
   * Récupère des chambres parsées du cache
   */
  getParsedRooms(text: string, hotelId: string): ExtractedRoom[] | null {
    const key = `${this.generateKey(text)}_${hotelId}`;
    const entry = this.patternCache.get(key);
    
    if (!entry) return null;
    
    // Vérifier le TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.patternCache.delete(key);
      return null;
    }
    
    entry.hits++;
    return entry.value;
  }

  /**
   * Stocke des chambres parsées
   */
  setParsedRooms(text: string, hotelId: string, rooms: ExtractedRoom[]): void {
    const key = `${this.generateKey(text)}_${hotelId}`;
    
    // Éviction LRU si nécessaire
    if (this.patternCache.size >= this.maxPatternCacheSize) {
      this.evictLRU(this.patternCache);
    }
    
    this.patternCache.set(key, {
      value: rooms,
      timestamp: Date.now(),
      hits: 0,
      hotelId
    });
  }

  /**
   * Éviction LRU (Least Recently Used)
   */
  private evictLRU<T>(cache: Map<string, CacheEntry<T>>): void {
    let lruKey: string | null = null;
    let lruScore = Infinity;
    
    for (const [key, entry] of cache.entries()) {
      // Score = hits * recency_factor
      const age = Date.now() - entry.timestamp;
      const score = entry.hits / (age + 1);
      
      if (score < lruScore) {
        lruScore = score;
        lruKey = key;
      }
    }
    
    if (lruKey) {
      cache.delete(lruKey);
    }
  }

  /**
   * Invalide le cache pour un hôtel spécifique
   */
  invalidateForHotel(hotelId: string): void {
    for (const [key, entry] of this.patternCache.entries()) {
      if (entry.hotelId === hotelId) {
        this.patternCache.delete(key);
      }
    }
  }

  /**
   * Vide tout le cache
   */
  clear(): void {
    this.detectionCache.clear();
    this.patternCache.clear();
  }

  /**
   * Statistiques du cache
   */
  getStats(): { detection: { size: number; maxSize: number }; pattern: { size: number; maxSize: number } } {
    return {
      detection: { size: this.detectionCache.size, maxSize: this.maxDetectionCacheSize },
      pattern: { size: this.patternCache.size, maxSize: this.maxPatternCacheSize }
    };
  }
}

// Singleton
export const detectionCache = new DetectionCache();
