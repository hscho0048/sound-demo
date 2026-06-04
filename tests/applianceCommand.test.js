import { describe, expect, it } from 'vitest';
import {
  COMMAND_TYPES,
  buildControlCommand,
  buildPlayCommand,
  buildStopCommand,
  buildVolumeCommand
} from '../src/api/applianceCommandApi.js';
import { isTelemetryStale } from '../src/api/applianceMeasurementApi.js';
import { computeNoiseWaveIntensity } from '../src/three/noiseEffect.js';
import {
  agentStatusCard,
  telemetryPanel
} from '../src/pages/ApplianceModuleControlPage.js';

describe('control command payload builder', () => {
  it('builds a PLAY_SAMPLE payload matching the API contract', () => {
    const command = buildControlCommand({
      commandType: 'PLAY_SAMPLE',
      applianceType: 'robot_vacuum',
      volumePercent: 70,
      mode: 'single'
    });
    expect(command).toEqual({
      targetDeviceId: 'esp32s3-appliance-controller-device-uuid',
      targetModuleId: 'esp32s3-appliance-01',
      agentId: 'appliance-controller-pc-01',
      commandType: 'PLAY_SAMPLE',
      payload: {
        applianceType: 'robot_vacuum',
        sampleName: 'robot_vacuum.wav',
        volumePercent: 70,
        mode: 'single'
      }
    });
  });

  it('builds a STOP_SAMPLE payload with only applianceType', () => {
    const command = buildStopCommand('robot_vacuum');
    expect(command.commandType).toBe('STOP_SAMPLE');
    expect(command.payload).toEqual({ applianceType: 'robot_vacuum' });
  });

  it('builds a SET_VOLUME payload with clamped volume', () => {
    const command = buildVolumeCommand(140);
    expect(command.commandType).toBe('SET_VOLUME');
    expect(command.payload).toEqual({ volumePercent: 100 });
  });

  it('rejects unsupported command types', () => {
    expect(() => buildControlCommand({ commandType: 'REBOOT' })).toThrow();
  });
});

describe('play button to command type mapping', () => {
  it('maps each appliance play button to a PLAY_SAMPLE command with its sample', () => {
    const cases = [
      ['washing_machine', 'washing_machine.wav'],
      ['dishwasher', 'dishwasher.wav'],
      ['robot_vacuum', 'robot_vacuum.wav']
    ];
    for (const [applianceType, sampleName] of cases) {
      const command = buildPlayCommand(applianceType);
      expect(command.commandType).toBe(COMMAND_TYPES.PLAY_SAMPLE);
      expect(command.payload.applianceType).toBe(applianceType);
      expect(command.payload.sampleName).toBe(sampleName);
    }
  });
});

describe('latest telemetry rendering', () => {
  it('renders telemetry fields including relative dB', () => {
    const html = telemetryPanel(
      {
        moduleId: 'esp32s3-appliance-01',
        applianceType: 'robot_vacuum',
        playbackState: 'PLAYING',
        sampleName: 'robot_vacuum.wav',
        volumePercent: 70,
        relativeDb: 61.8,
        decibelAvg: 60.4,
        decibelMax: 68.2,
        rms: 134.2,
        measuredBy: 'INMP441',
        moduleTimestampMs: 52340,
        receivedAt: '2026-06-03T12:15:01+09:00'
      },
      false
    );
    expect(html).toContain('esp32s3-appliance-01');
    expect(html).toContain('61.8 dB');
    expect(html).toContain('INMP441');
    expect(html).not.toContain('stale');
  });

  it('shows an empty state when no telemetry exists', () => {
    expect(telemetryPanel(null, true)).toContain('최신 텔레메트리가 없습니다');
  });
});

describe('agent offline state', () => {
  it('renders offline label when agent is offline', () => {
    const html = agentStatusCard({ agentId: 'a1', online: false, hostName: 'pc' });
    expect(html).toContain('오프라인');
    expect(html).not.toContain('status-card--accent');
  });

  it('renders online label when agent is online', () => {
    const html = agentStatusCard({ agentId: 'a1', online: true, hostName: 'pc' });
    expect(html).toContain('온라인');
    expect(html).toContain('status-card--accent');
  });
});

describe('stale telemetry state', () => {
  const now = new Date('2026-06-03T12:15:30+09:00').getTime();

  it('flags telemetry as stale when older than threshold', () => {
    const telemetry = { receivedAt: '2026-06-03T12:15:00+09:00' };
    expect(isTelemetryStale(telemetry, { now })).toBe(true);
  });

  it('treats fresh telemetry as not stale', () => {
    const telemetry = { receivedAt: '2026-06-03T12:15:29+09:00' };
    expect(isTelemetryStale(telemetry, { now })).toBe(false);
  });

  it('treats missing telemetry as stale', () => {
    expect(isTelemetryStale(null, { now })).toBe(true);
  });
});

describe('robot vacuum dB integration with 3D noise wave intensity', () => {
  it('maps higher relative dB to higher wave intensity', () => {
    const quiet = computeNoiseWaveIntensity(45);
    const loud = computeNoiseWaveIntensity(70);
    expect(loud).toBeGreaterThan(quiet);
  });

  it('clamps intensity within the safe range', () => {
    expect(computeNoiseWaveIntensity(10)).toBe(0.8);
    expect(computeNoiseWaveIntensity(200)).toBe(1.8);
  });

  it('falls back to a default when dB is missing', () => {
    expect(computeNoiseWaveIntensity(undefined)).toBeCloseTo(60 / 45, 5);
  });
});
