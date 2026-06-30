import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '../src/styles/theme';
import { developerService, DeveloperConsoleData } from '../src/services/developer/DeveloperService';

type RunningAction = 'sync' | 'delta' | 'validator' | 'assets' | 'tests' | null;

export default function DeveloperScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [data, setData] = useState<DeveloperConsoleData | null>(null);
  const [running, setRunning] = useState<RunningAction>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [timeline, setTimeline] = useState<any[] | null>(null);
  const [testOutput, setTestOutput] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const d = await developerService.getData();
    setData(d);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const runAction = async (action: RunningAction, fn: () => Promise<void>, label: string) => {
    setRunning(action);
    setStatusMessage(`${label}...`);
    try {
      await fn();
      setStatusMessage(`${label} OK`);
    } catch (e: any) {
      setStatusMessage(`${label} FAIL: ${e.message}`);
    }
    setRunning(null);
    refresh();
  };

  const handleSync = () => runAction('sync', () => developerService.runInitialSync(), 'Initial Sync');
  const handleDelta = () => runAction('delta', () => developerService.runDeltaSync(), 'Delta Sync');
  const handleValidator = async () => {
    setRunning('validator');
    setStatusMessage('Validator...');
    try {
      const result = await developerService.runValidator();
      setStatusMessage(`Entities: ${result.entities}, Assets: ${result.assets}`);
    } catch (e: any) {
      setStatusMessage(`Validator FAIL: ${e.message}`);
    }
    setRunning(null);
    refresh();
  };
  const handleTests = async () => {
    setRunning('tests');
    setStatusMessage('Running tests...');
    setTestOutput(null);
    try {
      const report = await developerService.runTests();
      setTestOutput(report);
      setStatusMessage('Tests complete');
    } catch (e: any) {
      setStatusMessage(`Tests FAIL: ${e.message}`);
    }
    setRunning(null);
    refresh();
  };

  const handleReplay = async () => {
    if (!data?.lastTraceId) {
      setStatusMessage('No sync trace available');
      return;
    }
    setStatusMessage(`Loading timeline: ${data.lastTraceId}`);
    const logs = await developerService.getTimeline(data.lastTraceId);
    setTimeline(logs);
    setStatusMessage(`${logs.length} events loaded`);
  };

  if (!data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0d1117' }}>
        <ActivityIndicator color="#C5A059" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const btn = (label: string, action: () => void, icon: string, disabled = false) => (
    <TouchableOpacity
      onPress={action}
      disabled={disabled}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingVertical: 10, paddingHorizontal: 16,
        backgroundColor: '#161b22', borderRadius: 8,
        borderWidth: 1, borderColor: '#30363d',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Ionicons name={icon as any} size={18} color="#C5A059" />
      <Text style={{ color: '#e6edf3', fontSize: 14, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );

  const statusBadge = (label: string, value: string, color: string) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ color: '#8b949e', fontSize: 13 }}>{label}</Text>
      <Text style={{ color, fontSize: 13, fontWeight: '600' }}>{value}</Text>
    </View>
  );

  const sectionHeader = (title: string) => (
    <Text style={{ color: '#C5A059', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 16, marginBottom: 8 }}>{title}</Text>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0d1117' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#21262d' }}>
        <Text style={{ color: '#e6edf3', fontSize: 18, fontWeight: '700' }}>Developer Console</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#8b949e" />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Confidence */}
        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
          <Text style={{ color: data.confidence >= 99 ? '#3fb950' : data.confidence >= 95 ? '#d29922' : '#f85149', fontSize: 48, fontWeight: '800' }}>
            {data.confidence}%
          </Text>
          <Text style={{ color: '#8b949e', fontSize: 12 }}>Confidence</Text>
        </View>

        {/* Actions */}
        {sectionHeader('Actions')}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {btn('Initial Sync', handleSync, 'download-outline', running !== null)}
          {btn('Delta Sync', handleDelta, 'sync-outline', running !== null)}
          {btn('Validator', handleValidator, 'checkmark-circle-outline', running !== null)}
          {btn('Run Tests', handleTests, 'flask-outline', running !== null)}
        </View>

        {statusMessage !== '' && (
          <View style={{ marginTop: 8, padding: 8, backgroundColor: '#161b22', borderRadius: 6 }}>
            <Text style={{ color: '#8b949e', fontSize: 12 }}>{statusMessage}</Text>
          </View>
        )}

        {/* Status */}
        {sectionHeader('Status')}
        <View style={{ backgroundColor: '#161b22', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#30363d' }}>
          {statusBadge('Sync State', data.syncState, data.syncState === 'READY' ? '#3fb950' : '#d29922')}
          {statusBadge('Last Sync', data.syncStatus === 'success' ? '✅ Success' : data.syncStatus === 'failed' ? '❌ Failed' : '⏳ Never', data.syncStatus === 'success' ? '#3fb950' : data.syncStatus === 'failed' ? '#f85149' : '#8b949e')}
          {data.syncError && statusBadge('Error', data.syncError, '#f85149')}
          {data.syncDurationMs > 0 && statusBadge('Duration', `${data.syncDurationMs}ms`, '#8b949e')}
          {statusBadge('Network', data.network, data.network === 'ONLINE' ? '#3fb950' : '#f85149')}
        </View>

        {/* Queue */}
        {sectionHeader('Queue')}
        <View style={{ backgroundColor: '#161b22', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#30363d' }}>
          {statusBadge('Pending', String(data.pending), data.pending === 0 ? '#3fb950' : '#d29922')}
          {statusBadge('Retries', String(data.retries), data.retries === 0 ? '#3fb950' : '#d29922')}
        </View>

        {/* Assets */}
        {sectionHeader('Assets')}
        <View style={{ backgroundColor: '#161b22', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#30363d' }}>
          {statusBadge('Uploading', String(data.uploading), '#8b949e')}
          {statusBadge('Downloading', String(data.downloading), '#8b949e')}
          {statusBadge('Corrupted', String(data.corrupted), data.corrupted === 0 ? '#3fb950' : '#f85149')}
          {statusBadge('Missing', String(data.missing), data.missing === 0 ? '#3fb950' : '#f85149')}
        </View>

        {/* Journal */}
        {sectionHeader('Sync Journal')}
        {data.recentSyncs.length === 0 ? (
          <Text style={{ color: '#8b949e', fontSize: 12 }}>No syncs recorded</Text>
        ) : (
          data.recentSyncs.map((s, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: i < data.recentSyncs.length - 1 ? 1 : 0, borderBottomColor: '#21262d' }}>
              <Text style={{ color: '#e6edf3', fontSize: 12 }}>
                {s.sync_type} {s.phase}
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Text style={{ color: s.status === 'success' ? '#3fb950' : '#f85149', fontSize: 12, fontWeight: '600' }}>{s.status}</Text>
                <Text style={{ color: '#8b949e', fontSize: 12 }}>{s.duration_ms}ms</Text>
              </View>
            </View>
          ))
        )}

        {/* Replay */}
        {sectionHeader('Replay Last Sync')}
        <TouchableOpacity
          onPress={handleReplay}
          disabled={!data.lastTraceId}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            paddingVertical: 10, paddingHorizontal: 16,
            backgroundColor: '#161b22', borderRadius: 8,
            borderWidth: 1, borderColor: '#30363d',
            opacity: data.lastTraceId ? 1 : 0.5,
          }}
        >
          <Ionicons name="time-outline" size={18} color="#C5A059" />
          <Text style={{ color: '#e6edf3', fontSize: 14, fontWeight: '600' }}>
            {data.lastTraceId ? `Replay: ${data.lastTraceId.slice(0, 16)}...` : 'No sync trace'}
          </Text>
        </TouchableOpacity>

        {timeline && (
          <View style={{ marginTop: 8, backgroundColor: '#161b22', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#30363d' }}>
            <Text style={{ color: '#C5A059', fontSize: 11, fontWeight: '700', marginBottom: 8 }}>TIMELINE ({timeline.length} events)</Text>
            {timeline.map((log, i) => (
              <View key={i} style={{ flexDirection: 'row', paddingVertical: 3, borderBottomWidth: i < timeline.length - 1 ? 1 : 0, borderBottomColor: '#21262d' }}>
                <Text style={{ color: '#8b949e', fontSize: 11, fontFamily: 'monospace', width: 80 }}>
                  {new Date(log.time).toLocaleTimeString()}
                </Text>
                <Text style={{
                  color: log.stage.startsWith('ERROR') || log.stage.includes('FAILED') ? '#f85149' :
                         log.stage.includes('START') ? '#d29922' :
                         log.stage.includes('FINISH') || log.stage.includes('OK') ? '#3fb950' : '#e6edf3',
                  fontSize: 11, fontFamily: 'monospace', fontWeight: '600', width: 100,
                }}>
                  {log.stage}
                </Text>
                <Text style={{ color: '#8b949e', fontSize: 11, flex: 1 }} numberOfLines={1}>
                  {log.message}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Test Output */}
        {testOutput && (
          <View style={{ marginTop: 8 }}>
            {sectionHeader('Test Results')}
            <View style={{ backgroundColor: '#161b22', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#30363d' }}>
              <Text style={{ color: '#e6edf3', fontSize: 11, fontFamily: 'monospace' }}>{testOutput}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
