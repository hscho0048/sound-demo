import { describe, expect, it } from 'vitest';
import { DecibelBadge } from '../src/components/DecibelBadge.js';
import { DeviceCard } from '../src/components/DeviceCard.js';
import { NotificationBanner } from '../src/components/NotificationBanner.js';
import { ReportCard } from '../src/components/ReportCard.js';
import { RoutineCard } from '../src/components/RoutineCard.js';
import { StatusCard } from '../src/components/StatusCard.js';
import { escapeHtml } from '../src/utils/html.js';
import {
  agentStatusCard,
  commandStatusPanel,
  telemetryPanel
} from '../src/pages/ApplianceModuleControlPage.js';

const attack = '"><img src=x onerror=alert(1)>';
const scriptAttack = '<script>alert(1)</script>';

function expectEscaped(html) {
  expect(html).not.toContain('<img src=x');
  expect(html).not.toContain('<script>');
  expect(html).not.toContain('</script>');
}

describe('HTML rendering escapes untrusted values', () => {
  it('escapes text and attribute-breaking characters', () => {
    expect(escapeHtml(attack)).toBe('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
  });

  it('escapes shared card components', () => {
    const fragments = [
      NotificationBanner({ id: attack, type: attack, title: scriptAttack, message: attack }),
      DeviceCard({ id: attack, name: scriptAttack, type: attack, roomName: attack, connected: true, lastSeenAt: attack }),
      RoutineCard({ id: attack, status: attack, title: scriptAttack, reason: attack, targetServiceLabel: attack }),
      ReportCard({ period: attack, summary: scriptAttack, eventCount: attack, negativeReactionCount: attack, topServiceLabel: attack }),
      StatusCard({ title: attack, value: scriptAttack, meta: attack, tone: attack }),
      DecibelBadge({ decibel: 64, label: attack })
    ];

    fragments.forEach(expectEscaped);
  });

  it('escapes appliance agent, command, and telemetry panels', () => {
    const fragments = [
      agentStatusCard({
        agentId: attack,
        online: true,
        hostName: scriptAttack,
        lastSeenAt: attack,
        connectedModuleIds: [attack],
        lastSerialPort: attack
      }),
      commandStatusPanel({
        commandId: attack,
        commandType: scriptAttack,
        status: attack,
        resultMessage: attack
      }),
      telemetryPanel({
        moduleId: attack,
        applianceType: scriptAttack,
        playbackState: attack,
        sampleName: attack,
        volumePercent: attack,
        relativeDb: attack,
        decibelAvg: attack,
        decibelMax: attack,
        rms: attack,
        measuredBy: attack,
        moduleTimestampMs: attack,
        receivedAt: attack
      }, false)
    ];

    fragments.forEach(expectEscaped);
  });
});
