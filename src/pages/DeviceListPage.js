import { escapeHtml } from '../utils/html.js';

const deviceRows = [
  { id: 'washer-main', room: 'Laundry Area', decibel: 71, time: '12:30' },
  { id: 'robot-living', room: 'Living Room', decibel: 71, time: '12:30' },
  { id: 'washer-laundry-2', room: 'Laundry Area', decibel: 71, time: '12:30' },
  { id: 'washer-laundry-3', room: 'Laundry Area', decibel: 71, time: '12:30' }
];

function deviceCard(device) {
  return `
    <a class="device-list-card" href="#/devices/${encodeURIComponent(device.id)}" aria-label="${escapeHtml(device.room)} device detail">
      <div class="device-list-picture" aria-hidden="true"></div>
      <div class="device-list-meta">
        <p>${escapeHtml(device.room)}</p>
        <p>${escapeHtml(device.decibel)} dB</p>
        <p>${escapeHtml(device.time)}</p>
      </div>
      <span class="device-refresh-icon" aria-hidden="true">↻</span>
    </a>
  `;
}

export async function renderDeviceListPage() {
  return `
    <section class="page device-list-page" aria-label="Device List Screen">
      <header class="device-list-header">
        <div class="device-list-heading">
          <h1>Devices</h1>
          <p>Total 8 registered · 6 connected · 2 unstable</p>
        </div>
        <button class="device-add-button" type="button">Add device</button>
      </header>

      <section class="device-filter-bar" aria-label="Device filters">
        <button type="button">Room: All</button>
        <button type="button">Connection: All</button>
        <label>
          <span class="hidden">Search device by name</span>
          <input type="search" placeholder="Search device by name" />
        </label>
      </section>

      <section class="device-warning-banner" aria-label="Device connection warning">
        <span class="device-warning-dot" aria-hidden="true"></span>
        <p>2 devices are disconnected or unstable. Check connection before relying on live status.</p>
        <button type="button">Review</button>
      </section>

      <section class="device-list-grid" aria-label="Registered devices">
        ${deviceRows.map(deviceCard).join('')}
      </section>
    </section>
  `;
}
