export interface EntitySynchronizer<T = any> {
  entityType: string;
  saveAll(items: T[]): Promise<number>;
  deleteItem(id: string): Promise<void>;
}
