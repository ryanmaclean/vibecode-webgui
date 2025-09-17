/**
 * MCP Context7: In-Memory Storage Provider
 * 
 * This provider stores context data in memory using a Map.
 * It is intended for development, testing, or scenarios where persistence is not required.
 */
import { Context7StorageProvider } from '../interfaces';

export class InMemoryStorageProvider implements Context7StorageProvider {
  private storage: Map<string, any>;

  constructor() {
    this.storage = new Map<string, any>();
  }

  /**
   * Saves data to the in-memory store.
   * @param key - The key to store the data under.
   * @param data - The data to store.
   * @returns A promise that resolves to true if the data was saved successfully.
   */
  public async save(key: string, data: any): Promise<boolean> {
    this.storage.set(key, data);
    return true;
  }

  /**
   * Loads data from the in-memory store.
   * @param key - The key of the data to load.
   * @returns A promise that resolves to the loaded data, or null if not found.
   */
  public async load(key: string): Promise<any | null> {
    const data = this.storage.get(key);
    return data !== undefined ? data : null;
  }

  /**
   * Deletes data from the in-memory store.
   * @param key - The key of the data to delete.
   * @returns A promise that resolves to true if the data was deleted successfully.
   */
  public async delete(key: string): Promise<boolean> {
    return this.storage.delete(key);
  }

  /**
   * Clears all data from the in-memory store.
   * @returns A promise that resolves to true when the store is cleared.
   */
  public async clear(): Promise<boolean> {
    this.storage.clear();
    return true;
  }
}
