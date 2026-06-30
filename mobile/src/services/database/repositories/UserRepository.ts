import { BaseRepository } from '../BaseRepository';
import type { UserProfile } from '../../api/types';

export interface User {
  id: string; // UUID PRIMARY KEY
  email: string;
  name?: string;
  token: string;
  refresh_token?: string;
  profile_image_url?: string;
  lastname?: string | null;
  username?: string | null;
  major?: string | null;
  university?: string | null;
  semester?: string | null;
  study_goal?: string | null;
  profile_image?: string | null;
  display_name?: string | null;
  share_pin?: string | null;
  approval_threshold?: number | null;
  grading_scale?: string | null;
  active_grading_version_id?: string | null;
  last_login?: string | null;
  reference_language?: string | null;
  biometric_token?: string | null;
  version_number?: number;
  last_modified_by?: string;
  deleted_at?: string;
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

  async getCurrentUser(): Promise<User | undefined> {
    const users = await this.getAll();
    return users.length > 0 ? users[0] : undefined;
  }

  async updateToken(userId: string, token: string, refreshToken?: string): Promise<void> {
    await this.update(userId, { 
      token, 
      refresh_token: refreshToken 
    });
  }

  async saveUser(user: User): Promise<void> {
    const existing = await this.getById(user.id);
    if (existing) {
      await this.update(user.id, user);
    } else {
      await this.create(user);
    }
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    await this.upsert({
      id: profile.id,
      email: profile.email,
      name: profile.name ?? undefined,
      lastname: profile.lastname,
      username: profile.username,
      profile_image_url: profile.profile_image ?? undefined,
      profile_image: profile.profile_image,
      major: profile.major,
      university: profile.university,
      semester: profile.semester,
      study_goal: profile.study_goal,
      display_name: profile.display_name,
      share_pin: profile.share_pin,
      approval_threshold: profile.approval_threshold,
      grading_scale: profile.grading_scale,
      active_grading_version_id: profile.active_grading_version_id,
      last_login: profile.last_login,
      reference_language: profile.reference_language,
    } as any);
  }

  async clearUser(): Promise<void> {
    const users = await this.getAll();
    for (const user of users) {
      await this.delete(user.id);
    }
  }
}

export const userRepository = UserRepository.getInstance();
