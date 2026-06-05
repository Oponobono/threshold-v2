import { BaseRepository } from '../BaseRepository';
import { databaseService } from '../DatabaseService';

export interface User {
  id: string; // UUID PRIMARY KEY
  email: string;
  name?: string;
  token: string;
  refresh_token?: string;
  profile_image_url?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * UserRepository - Gestiona datos de usuario autenticado
 * Centraliza auth data en SQLite en lugar de distribuir entre MMKV + BD
 */
export class UserRepository extends BaseRepository<User> {
  private static instance: UserRepository;

  private constructor() {
    super('users');
  }

  static getInstance(): UserRepository {
    if (!UserRepository.instance) {
      UserRepository.instance = new UserRepository();
    }
    return UserRepository.instance;
  }

  /**
   * Obtener usuario actual (típicamente el único en la BD local)
   */
  async getCurrentUser(): Promise<User | undefined> {
    const users = await this.getAll();
    return users.length > 0 ? users[0] : undefined;
  }

  /**
   * Actualizar token de autenticación
   */
  async updateToken(userId: string, token: string, refreshToken?: string): Promise<void> {
    await this.update(userId, { 
      token, 
      refresh_token: refreshToken 
    });
  }

  /**
   * Guardar usuario (login)
   */
  async saveUser(user: User): Promise<void> {
    const existing = await this.getById(user.id);
    if (existing) {
      await this.update(user.id, user);
    } else {
      await this.create(user);
    }
  }

  /**
   * Limpiar usuario (logout)
   */
  async clearUser(): Promise<void> {
    const users = await this.getAll();
    for (const user of users) {
      await this.delete(user.id);
    }
  }
}

export const userRepository = UserRepository.getInstance();
