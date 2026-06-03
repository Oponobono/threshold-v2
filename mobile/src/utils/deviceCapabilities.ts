import { Platform, NativeModules } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Device from 'expo-device';
import { LocalModelId } from '../store/useLocalAIStore';

export interface DeviceCapabilities {
  totalRamGB: number;
  availableRamGB: number;
  usableRamGB: number; // RAM disponible - 20% de seguridad
  cpuCoreCount: number;
  recommendedThreads: number;
  tier: 'low' | 'mid' | 'high';
  compatibleModels: LocalModelId[];
  recommendedModel: LocalModelId;
}

let cachedCapabilities: DeviceCapabilities | null = null;

interface RamInfo {
  totalMB: number;
  availableMB: number;
}

/**
 * Intento 1 (más preciso): expo-device
 * Device.totalMemory devuelve la RAM física real en bytes
 * en Android e iOS sin necesidad de permisos adicionales.
 */
async function getExpoDeviceRam(): Promise<RamInfo | null> {
  try {
    const totalBytes = await Device.totalMemory;
    if (totalBytes && totalBytes > 0) {
      const totalMB = Math.round(totalBytes / (1024 * 1024));
      if (totalMB >= 512 && totalMB <= 32768) {
        // Para RAM disponible, leer /proc/meminfo solo para MemAvailable.
        // Si falla, estimamos el 55% como libre (promedio real en Android en reposo).
        let availableMB = Math.round(totalMB * 0.55);
        try {
          if (Platform.OS === 'android') {
            const content = await FileSystem.readAsStringAsync('file:///proc/meminfo');
            const memAvailMatch = content.match(/MemAvailable:\s*(\d+)\s*kB/);
            if (memAvailMatch) {
              const parsed = Math.round(parseInt(memAvailMatch[1], 10) / 1024);
              if (parsed > 0 && parsed <= totalMB) {
                availableMB = parsed;
              }
            }
          }
        } catch (_) {}
        console.log(`[RAM Detection] expo-device - Total: ${totalMB}MB, Available: ${availableMB}MB`);
        return { totalMB, availableMB };
      }
    }
  } catch (e) {
    console.warn('[RAM Detection] expo-device failed:', e);
  }
  return null;
}

/**
 * Intento 2 (fallback): /proc/meminfo completo
 * MemTotal: RAM física total del dispositivo
 * MemAvailable: RAM estimada disponible para nuevos procesos
 */
async function getProcMeminfo(): Promise<RamInfo | null> {
  if (Platform.OS !== 'android') return null;

  try {
    const content = await FileSystem.readAsStringAsync('file:///proc/meminfo');
    const memTotalMatch = content.match(/MemTotal:\s*(\d+)\s*kB/);
    const memAvailMatch = content.match(/MemAvailable:\s*(\d+)\s*kB/);

    if (memTotalMatch && memAvailMatch) {
      const totalMB = Math.round(parseInt(memTotalMatch[1], 10) / 1024);
      const availableMB = Math.round(parseInt(memAvailMatch[1], 10) / 1024);

      // Validación: valores razonables
      if (totalMB >= 512 && totalMB <= 16384 && availableMB > 0 && availableMB <= totalMB) {
        return { totalMB, availableMB };
      }
    }
  } catch (e) {
    console.warn('[RAM Detection] Failed to read /proc/meminfo:', e);
  }

  return null;
}

async function getRamInfo(): Promise<RamInfo> {
  // Intento 1: expo-device (más preciso, funciona en Android e iOS)
  const expoRam = await getExpoDeviceRam();
  if (expoRam) return expoRam;

  // Intento 2: /proc/meminfo (fallback Android)
  const procInfo = await getProcMeminfo();
  if (procInfo) {
    console.log(
      `[RAM Detection] /proc/meminfo - Total: ${procInfo.totalMB}MB, Available: ${procInfo.availableMB}MB`
    );
    return procInfo;
  }

  // Intento 3: Fallback para Android - inferir del API level
  if (Platform.OS === 'android') {
    try {
      const apiLevel = typeof Platform.Version === 'number'
        ? Platform.Version
        : parseInt(String(Platform.Version), 10);
      let estimatedTotal = 4096;
      if (apiLevel >= 33) estimatedTotal = 8192;       // Android 13+
      else if (apiLevel >= 31) estimatedTotal = 6144;  // Android 12
      else if (apiLevel >= 29) estimatedTotal = 4096;  // Android 10-11
      else estimatedTotal = 3072;                       // Android 9-

      const estimatedAvailable = Math.round(estimatedTotal * 0.55);
      console.log(
        `[RAM Detection] API level ${apiLevel} fallback - Total: ${estimatedTotal}MB, Available: ${estimatedAvailable}MB (ESTIMATE)`
      );
      return { totalMB: estimatedTotal, availableMB: estimatedAvailable };
    } catch {}
  }

  // Fallback final seguro
  console.log('[RAM Detection] Using default fallback - Total: 4096MB, Available: 2240MB');
  return { totalMB: 4096, availableMB: 2240 };
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

  const ramInfo = await getRamInfo();
  const totalRamGB = Math.round(ramInfo.totalMB / 1024 * 10) / 10;
  const availableRamGB = Math.round(ramInfo.availableMB / 1024 * 10) / 10;
  
  // RAM utilizable = RAM disponible - 20% de seguridad (para no cerrar apps en segundo plano)
  const usableRamMB = Math.round(ramInfo.availableMB * 0.8);
  const usableRamGB = Math.round(usableRamMB / 1024 * 10) / 10;

  const cpuCoreCount = getCpuCoreCount();
  const recommendedThreads = Math.max(2, Math.min(Math.floor(cpuCoreCount * 0.6), cpuCoreCount - 1));

  let tier: DeviceCapabilities['tier'];
  let compatibleModels: LocalModelId[];

  /**
   * Clasificación basada en RAM UTILIZABLE (no total)
   * Esto evita que se descarguen modelos que causarían crashes
   * por falta de memoria disponible
   */
  if (usableRamMB <= 1536) {
    // Muy baja (≤ 1.5GB utilizable)
    tier = 'low';
    compatibleModels = ['essential']; // ~800MB descarga
  } else if (usableRamMB <= 2560) {
    // Baja (1.5-2.5GB utilizable)
    tier = 'low';
    compatibleModels = ['essential', 'qwen_1_5b']; // ~1.1GB descarga
  } else if (usableRamMB <= 4096) {
    // Media (2.5-4GB utilizable)
    tier = 'mid';
    compatibleModels = ['essential', 'qwen_1_5b', 'gemma2_2b']; // ~1.6GB descarga
  } else if (usableRamMB <= 5632) {
    // Alta (4-5.5GB utilizable)
    tier = 'high';
    compatibleModels = ['essential', 'qwen_1_5b', 'qwen_3b', 'gemma2_2b']; // ~2.2GB descarga
  } else {
    // Muy alta (>5.5GB utilizable)
    tier = 'high';
    compatibleModels = ['essential', 'qwen_1_5b', 'qwen_3b', 'gemma2_2b', 'advanced', 'phi3_5'];
  }

  const recommendedModel: LocalModelId = compatibleModels[0];

  cachedCapabilities = {
    totalRamGB,
    availableRamGB,
    usableRamGB,
    cpuCoreCount,
    recommendedThreads,
    tier,
    compatibleModels,
    recommendedModel,
  };

  console.log(
    `[Device] Total: ${totalRamGB}GB | Available: ${availableRamGB}GB | Usable: ${usableRamGB}GB | Tier: ${tier} | Models: ${compatibleModels.join(', ')}`
  );

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
