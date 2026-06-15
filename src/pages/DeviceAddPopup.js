import {
  createCustomDevice,
  DEVICE_ROOM_OPTIONS,
  DEVICE_TYPE_OPTIONS
} from '../utils/customDevicesState.js';
import { bindBackdropDismiss, ensurePopupRoot, setPopupVisible } from '../utils/popup.js';

function dropdownMarkup(name, options) {
  const selected = options[0];

  return `
    <input type="hidden" name="${name}" value="${selected.value}">
    <div class="device-add-dropdown" data-device-add-dropdown="${name}">
      <button type="button" class="device-add-select-trigger" data-device-add-trigger="${name}">
        <span>${selected.label}</span>
      </button>
      <div class="device-add-select-menu" data-device-add-menu="${name}" hidden>
        ${options
          .map(
            (option) => `
              <button type="button" data-device-add-option="${name}" data-device-add-value="${option.value}">
                ${option.label}
              </button>
            `
          )
          .join('')}
      </div>
    </div>
  `;
}

export function renderDeviceAddPopup() {
  return `
    <div id="device-add-popup" class="device-add-backdrop hidden" aria-hidden="true">
      <section class="device-add-modal" role="dialog" aria-modal="true" aria-labelledby="device-add-title">
        <h2 id="device-add-title">기기 추가</h2>
        <p class="device-add-subtitle">관리할 가전의 종류와 공간을 지정해 주세요.</p>

        <form id="device-add-form" class="device-add-form">
          <label>
            <span>기기 종류</span>
            ${dropdownMarkup('deviceType', DEVICE_TYPE_OPTIONS)}
          </label>

          <label>
            <span>기기 이름</span>
            <input name="deviceName" type="text" placeholder="기기 이름을 입력하세요" />
          </label>

          <label>
            <span>공간</span>
            ${dropdownMarkup('room', DEVICE_ROOM_OPTIONS)}
          </label>

          <div class="device-add-sensitive-row">
            <div>
              <strong>민감 관리</strong>
              <p>추가 후 목록 카드에 민감 관리 상태를 표시합니다.</p>
            </div>
            <button class="device-add-sensitive-toggle" type="button" role="switch" aria-checked="false" data-device-add-sensitive>
              <span aria-hidden="true"><span></span></span>
              <em>OFF</em>
            </button>
          </div>

          <div class="device-add-note">
            <strong>초기 상태</strong>
            <p>새로 추가한 기기는 연결 확인 전까지 ‘연결 필요’ 상태로 표시됩니다.</p>
          </div>

          <div class="device-add-actions">
            <button type="button" class="device-add-secondary" data-device-add-cancel>취소</button>
            <button type="submit" class="device-add-primary">기기 추가</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

export function mountDeviceAddPopup({ onAdd } = {}) {
  const root = ensurePopupRoot('device-add-popup-root');
  root.innerHTML = renderDeviceAddPopup();

  const popup = root.querySelector('#device-add-popup');
  const form = root.querySelector('#device-add-form');
  const typeInput = root.querySelector('input[name="deviceType"]');
  const roomInput = root.querySelector('input[name="room"]');
  const nameInput = root.querySelector('input[name="deviceName"]');
  const sensitiveToggle = root.querySelector('[data-device-add-sensitive]');
  const cancelButton = root.querySelector('[data-device-add-cancel]');

  const setDropdownValue = (name, value) => {
    const input = name === 'deviceType' ? typeInput : roomInput;
    const options = name === 'deviceType' ? DEVICE_TYPE_OPTIONS : DEVICE_ROOM_OPTIONS;
    const selected = options.find((option) => option.value === value) ?? options[0];
    const triggerLabel = root.querySelector(`[data-device-add-trigger="${name}"] span`);

    if (input) input.value = selected.value;
    if (triggerLabel) triggerLabel.textContent = selected.label;
  };

  const updateDeviceName = () => {
    const type = DEVICE_TYPE_OPTIONS.find((option) => option.value === typeInput?.value);
    if (nameInput) nameInput.value = type?.defaultName ?? '';
  };

  const closePopup = () => setPopupVisible(popup, false);
  const openPopup = () => {
    form?.reset();
    setDropdownValue('deviceType', DEVICE_TYPE_OPTIONS[0].value);
    setDropdownValue('room', DEVICE_ROOM_OPTIONS[0].value);
    updateDeviceName();
    sensitiveToggle?.classList.remove('is-on');
    sensitiveToggle?.setAttribute('aria-checked', 'false');
    const label = sensitiveToggle?.querySelector('em');
    if (label) label.textContent = 'OFF';
    setPopupVisible(popup, true);
  };

  root.querySelectorAll('[data-device-add-trigger]').forEach((button) => {
    button.addEventListener('click', () => {
      const name = button.dataset.deviceAddTrigger;
      root.querySelectorAll('[data-device-add-menu]').forEach((menu) => {
        menu.hidden = menu.dataset.deviceAddMenu === name ? !menu.hidden : true;
      });
    });
  });

  root.querySelectorAll('[data-device-add-option]').forEach((button) => {
    button.addEventListener('click', () => {
      const name = button.dataset.deviceAddOption;
      setDropdownValue(name, button.dataset.deviceAddValue);
      root.querySelectorAll('[data-device-add-menu]').forEach((menu) => {
        menu.hidden = true;
      });

      if (name === 'deviceType') updateDeviceName();
    });
  });

  sensitiveToggle?.addEventListener('click', () => {
    const enabled = !sensitiveToggle.classList.contains('is-on');
    sensitiveToggle.classList.toggle('is-on', enabled);
    sensitiveToggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
    const label = sensitiveToggle.querySelector('em');
    if (label) label.textContent = enabled ? 'ON' : 'OFF';
  });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const device = createCustomDevice({
      deviceType: formData.get('deviceType'),
      deviceName: formData.get('deviceName'),
      room: formData.get('room')
    });
    onAdd?.({
      device,
      sensitiveManaged: sensitiveToggle?.classList.contains('is-on') ?? false
    });
    closePopup();
  });

  bindBackdropDismiss(popup, closePopup);
  cancelButton?.addEventListener('click', closePopup);

  const closeMenus = (event) => {
    if (!event.target.closest('.device-add-dropdown')) {
      root.querySelectorAll('[data-device-add-menu]').forEach((menu) => {
        menu.hidden = true;
      });
    }
  };
  document.addEventListener('click', closeMenus);

  const cleanup = () => {
    document.removeEventListener('click', closeMenus);
    root?.remove();
  };

  return { openPopup, closePopup, cleanup };
}
