import mockTelemetry from '../data/mockApplianceModuleTelemetry.json';
import { request, isMockApiEnabled, buildQuery } from './client.js';

// Tauri/Web은 ESP32-S3 Serial을 직접 열지 않는다. 대신 Spring Boot의
// 제어 명령 API로 명령을 생성하고, Appliance Controller Agent PC가 명령을
// 수신해 USB Serial로 ESP32-S3 통합 가전 모형 제어 모듈에 전달한다.

export const COMMAND_TYPES = Object.freeze({
  PLAY_SAMPLE: 'PLAY_SAMPLE',
  STOP_SAMPLE: 'STOP_SAMPLE',
  SET_VOLUME: 'SET_VOLUME'
});

export const COMMAND_STATUSES = Object.freeze([
  'PENDING',
  'SENT',
  'APPLIED',
  'FAILED',
  'TIMEOUT',
  'CANCELLED'
]);

// 재생 버튼(applianceType) → 재생 샘플 파일 매핑.
export const APPLIANCE_SAMPLES = Object.freeze({
  washing_machine: 'washing_machine.wav',
  dishwasher: 'dishwasher.wav',
  robot_vacuum: 'robot_vacuum.wav'
});

const DEFAULT_TARGET = Object.freeze({
  targetDeviceId: 'esp32s3-appliance-controller-device-uuid',
  targetModuleId: 'esp32s3-appliance-01',
  agentId: 'appliance-controller-pc-01'
});

/**
 * 제어 명령 payload를 만든다. commandType에 따라 payload 형태가 달라진다.
 * 순수 함수로 구현해 단위 테스트가 쉽도록 한다.
 *
 * @param {object} input
 * @param {string} input.commandType - COMMAND_TYPES 값
 * @param {string} [input.applianceType] - robot_vacuum, washing_machine, dishwasher
 * @param {number} [input.volumePercent]
 * @param {('single'|'loop')} [input.mode]
 * @param {string} [input.sampleName] - 미지정 시 applianceType 기본 샘플 사용
 * @param {object} [input.target] - targetDeviceId, targetModuleId, agentId override
 */
export function buildControlCommand(input = {}) {
  const {
    commandType,
    applianceType,
    volumePercent,
    mode = 'single',
    sampleName,
    target = {}
  } = input;

  if (!COMMAND_TYPES[commandType]) {
    throw new Error(`지원하지 않는 commandType: ${commandType}`);
  }

  const base = {
    targetDeviceId: target.targetDeviceId ?? DEFAULT_TARGET.targetDeviceId,
    targetModuleId: target.targetModuleId ?? DEFAULT_TARGET.targetModuleId,
    agentId: target.agentId ?? DEFAULT_TARGET.agentId,
    commandType
  };

  if (commandType === COMMAND_TYPES.PLAY_SAMPLE) {
    if (!applianceType) {
      throw new Error('PLAY_SAMPLE 명령에는 applianceType이 필요합니다.');
    }
    return {
      ...base,
      payload: {
        applianceType,
        sampleName: sampleName ?? APPLIANCE_SAMPLES[applianceType] ?? `${applianceType}.wav`,
        volumePercent: clampVolume(volumePercent ?? 70),
        mode: mode === 'loop' ? 'loop' : 'single'
      }
    };
  }

  if (commandType === COMMAND_TYPES.STOP_SAMPLE) {
    return {
      ...base,
      payload: applianceType ? { applianceType } : {}
    };
  }

  // SET_VOLUME
  return {
    ...base,
    payload: {
      volumePercent: clampVolume(volumePercent ?? 70)
    }
  };
}

/**
 * 재생 버튼을 누르면 항상 PLAY_SAMPLE 명령으로 매핑된다.
 * applianceType만 버튼마다 다르다.
 */
export function buildPlayCommand(applianceType, { volumePercent = 70, mode = 'single', target } = {}) {
  return buildControlCommand({
    commandType: COMMAND_TYPES.PLAY_SAMPLE,
    applianceType,
    volumePercent,
    mode,
    target
  });
}

export function buildStopCommand(applianceType, { target } = {}) {
  return buildControlCommand({
    commandType: COMMAND_TYPES.STOP_SAMPLE,
    applianceType,
    target
  });
}

export function buildVolumeCommand(volumePercent, { target } = {}) {
  return buildControlCommand({
    commandType: COMMAND_TYPES.SET_VOLUME,
    volumePercent,
    target
  });
}

function clampVolume(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 70;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export async function createControlCommand(command) {
  if (isMockApiEnabled()) {
    // Mock 모드에서는 명령을 즉시 PENDING으로 수락한 것처럼 응답한다.
    return {
      commandId: `cmd-mock-${Date.now()}`,
      ...command,
      status: 'PENDING',
      resultMessage: 'Mock 모드: Spring Boot가 명령을 수신했다고 가정합니다.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
  return request('/api/control-commands', { method: 'POST', body: command });
}

export async function getControlCommands(params = {}) {
  if (isMockApiEnabled()) {
    return mockTelemetry.controlCommands;
  }
  return request(`/api/control-commands${buildQuery(params)}`);
}

export async function getLatestControlCommand(params = {}) {
  const commands = await getControlCommands(params);
  return commands?.[0] ?? null;
}
