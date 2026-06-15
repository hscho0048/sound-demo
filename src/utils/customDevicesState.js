const STORAGE_KEY = 'soundcare.customDevices';

export const DEVICE_TYPE_OPTIONS = [
  { value: 'washer', label: '세탁기', defaultName: '세탁기', modelType: 'washer', serviceLabel: '세탁 관리' },
  { value: 'robot', label: '로봇청소기', defaultName: '로봇청소기', modelType: 'robot', serviceLabel: '청소 관리' },
  { value: 'refrigerator', label: '냉장고', defaultName: '냉장고', modelType: 'refrigerator', serviceLabel: '연결 확인' },
  { value: 'ac', label: '에어컨', defaultName: '에어컨', modelType: 'washer', serviceLabel: '공기 조절' },
  { value: 'dishwasher', label: '식기세척기', defaultName: '식기세척기', modelType: 'dishwasher', serviceLabel: '저소음 모드' },
  { value: 'hub', label: 'LG 허브', defaultName: 'LG 허브', modelType: 'robot', serviceLabel: '허브 연결' }
];

export const DEVICE_ROOM_OPTIONS = [
  { value: 'Living Room', label: '거실' },
  { value: 'Bedroom', label: '침실' },
  { value: 'Laundry Area', label: '세탁실' },
  { value: 'Kitchen', label: '주방' },
  { value: 'Study', label: '작업실' }
];

function readDevices() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDevices(devices) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
  } catch {
    // Local storage can fail in restricted environments; ignore and keep UI responsive.
  }
}

function getCurrentTimeLabel() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function getCustomDevices() {
  return readDevices();
}

export function createCustomDevice({ deviceType, deviceName, room }) {
  const type = DEVICE_TYPE_OPTIONS.find((option) => option.value === deviceType) ?? DEVICE_TYPE_OPTIONS[0];
  const trimmedName = String(deviceName || '').trim();

  return {
    id: `custom-${type.value}-${Date.now()}`,
    deviceType: type.value,
    deviceName: trimmedName || type.defaultName,
    room,
    decibel: '--',
    time: getCurrentTimeLabel(),
    modelType: type.modelType,
    modelLabel: trimmedName || type.defaultName,
    serviceLabel: type.serviceLabel,
    events: ['기기 연결 상태 확인 필요', '추가된 기기 등록 완료', '측정값 대기 중'],
    recommendation: '기기 연결 상태를 확인한 뒤 소음 관리 설정을 진행하세요.'
  };
}

export function addCustomDevice(device) {
  const devices = readDevices();
  devices.push(device);
  writeDevices(devices);
  return device;
}
