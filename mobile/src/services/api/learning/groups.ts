import { fetchWithFallback, parseJsonSafely } from '../client';
import { getUserId } from '../auth';
import { syncService } from '../../database';
import { uuidv4 } from '../../../utils/uuid';

export interface GroupMembership {
  id?: string;
  user_id?: string;
  group_pin_id: string;
  name?: string;
  role?: string;
  joined_at?: string;
  is_public?: boolean;
  password?: string;
}

export interface CreateGroupParams {
  group_pin_id: string;
  name: string;
  is_public: boolean;
  password?: string;
}

export const getUserGroups = async (): Promise<GroupMembership[]> => {
  try {
    const userId = await getUserId();
    if (!userId) return [];
    const response = await fetchWithFallback(`/learning/groups/${userId}`);
    const data = await parseJsonSafely(response);
    if (!response.ok) return [];
    return data || [];
  } catch {
    return [];
  }
};

export const joinGroup = async (group_pin_id: string, password?: string): Promise<any> => {
  const userId = await getUserId();
  if (!userId) throw new Error('Usuario no autenticado');
  const body: any = { user_id: userId, group_pin_id };
  if (password) body.password = password;

  try {
    const response = await fetchWithFallback('/learning/groups/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const responseData = await parseJsonSafely(response);
    if (!response.ok) throw new Error(responseData?.error || 'Error al unirse al grupo');
    return responseData;
  } catch (error: any) {
    await syncService.enqueueCreate('group-membership', group_pin_id, body);
    throw new Error(error.message || 'Error de red al intentar unirse al grupo');
  }
};

export const leaveGroup = async (group_pin_id: string): Promise<any> => {
  const userId = await getUserId();
  if (!userId) throw new Error('Usuario no autenticado');

  try {
    const response = await fetchWithFallback('/learning/groups/leave', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, group_pin_id }),
    });
    const responseData = await parseJsonSafely(response);
    if (!response.ok) throw new Error(responseData?.error || 'Error al salir del grupo');
    return responseData;
  } catch (error: any) {
    await syncService.enqueueDelete('group-membership', group_pin_id);
    throw new Error(error.message || 'Error de red al intentar salir del grupo');
  }
};

export const getGroupDecks = async (groupPinId: string): Promise<any[]> => {
  try {
    const response = await fetchWithFallback(`/learning/groups/${groupPinId}/decks`);
    const data = await parseJsonSafely(response);
    return data || [];
  } catch {
    return [];
  }
};

export interface LeaderboardEntry {
  userId: string;
  username: string;
  displayName: string | null;
  profileImage: string | null;
  gpa: number;
  assessmentCount: number;
  subjectCount: number;
}

export const getGroupLeaderboard = async (groupPinId: string): Promise<LeaderboardEntry[]> => {
  try {
    const response = await fetchWithFallback(`/learning/groups/${groupPinId}/leaderboard`);
    const data = await parseJsonSafely(response);
    return data?.leaderboard || [];
  } catch {
    return [];
  }
};

export const createGroup = async (params: CreateGroupParams): Promise<any> => {
  const userId = await getUserId();
  if (!userId) throw new Error('Usuario no autenticado');

  try {
    const response = await fetchWithFallback('/learning/groups/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creator_user_id: userId, ...params }),
    });
    const responseData = await parseJsonSafely(response);
    if (!response.ok) throw new Error(responseData?.error || 'Error al crear el grupo');
    return responseData;
  } catch (error: any) {
    const id = uuidv4();
    await syncService.enqueueCreate('group', id, { creator_user_id: userId, ...params });
    throw new Error(error.message || 'Error de red al intentar crear el grupo');
  }
};
