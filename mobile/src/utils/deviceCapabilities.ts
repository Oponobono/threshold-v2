import { Platform, NativeModules } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { LocalModelId } from '../store/useLocalAIStore';

export interface DeviceCapabilities {
  totalRamGB: number;
  cpuCoreCount: number;
  recommendedThreads: number;
  tier: 'low' | 'mid' | 'high';
  compatibleModels: LocalModelId[];
  recommendedModel: LocalModelId;
}

let cachedCapabilities: DeviceCapabilities | null = null;

async function getAndroidTotalRamMB(): Promise<number> {
  if (Platform.OS !== 'android') return 4096;

  // Intentar leer /proc/meminfo vía expo-file-system
  try {
    const content = await FileSystem.readAsStringAsync('file:///proc/meminfo');
    const match = content.match(/MemTotal:\s*(\d+)\s*kB/);
    if (match) {
      return Math.round(parseInt(match[1], 10) / 1024);
    }
  } catch {}

  // Intento con polyfill de OS si existe
  try {
    const os = require('os');
    const totalMem = os?.totalmem?.();
    if (totalMem && totalMem > 0) return Math.round(totalMem / (1024 * 1024));
  } catch {}

  // Fallback: inferir del API level
  try {
    const apiLevel = typeof Platform.Version === 'number'
      ? Platform.Version
      : parseInt(String(Platform.Version), 10);
    if (apiLevel >= 31) return 4096; // Android 12+
    if (apiLevel >= 29) return 3072; // Android 10-11
    return 2048; // Android 9-
  } catch {
    return 3072;
  }
}

function getCpuCoreCount(): number {
  try {
    const { DeviceInfo } = NativeModules;
    if (DeviceInfo?.getConstant?.()?.availableCpuCount) {
      return DeviceInfo.getConstant().availableCpuCount;
    }
  } catch {}
  try {
    const os = require('os');
    const cpus = os?.cpus?.()?.length;
    if (cpus && cpus > 0) return cpus;
  } catch {}
  return 6;
}

export async function getDeviceCapabilities(): Promise<DeviceCapabilities> {
  if (cachedCapabilities) return cachedCapabilities;

  const totalRamMB = await getAndroidTotalRamMB();
  const totalRamGB = Math.round(totalRamMB / 1024 * 10) / 10;
  const cpuCoreCount = getCpuCoreCount();
  const recommendedThreads = Math.max(2, Math.min(Math.floor(cpuCoreCount * 0.6), cpuCoreCount - 1));

  let tier: DeviceCapabilities['tier'];
  let compatibleModels: LocalModelId[];

  if (totalRamMB <= 3072) {
    tier = 'low';
    compatibleModels = ['essential'];
  } else if (totalRamMB <= 4096) {
    tier = 'mid';
    compatibleModels = ['essential', 'qwen_1_5b', 'gemma2_2b'];
  } else {
    tier = 'high';
    compatibleModels = ['essential', 'qwen_1_5b', 'qwen_3b', 'gemma2_2b', 'advanced', 'phi3_5'];
  }

  const recommendedModel: LocalModelId = compatibleModels[0];

  cachedCapabilities = {
    totalRamGB,
    cpuCoreCount,
    recommendedThreads,
    tier,
    compatibleModels,
    recommendedModel,
  };

  return cachedCapabilities;
}

export function getDynamicThreads(cpuCoreCount: number, totalRamGB: number): number {
  const base = Math.max(2, Math.min(Math.floor(cpuCoreCount * 0.6), cpuCoreCount - 1));
  if (totalRamGB <= 3) return Math.min(base, 4);
  if (totalRamGB <= 4) return Math.min(base, 6);
  return base;
}

export function clearCapabilitiesCache(): void {
  cachedCapabilities = null;
}
