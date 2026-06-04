import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const mappingPath = path.resolve('src/data/labelMapping.json');
const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));

describe('SoundCare label mapping', () => {
  it('vacuum_cleaner maps to robot_vacuum at service layer', () => {
    expect(mapping.serviceLabelMapping.vacuum_cleaner).toBe('robot_vacuum');
  });

  it('contains four MVP model labels', () => {
    expect(mapping.modelLabels).toEqual([
      'vacuum_cleaner',
      'washing_machine',
      'dishwasher',
      'background'
    ]);
  });
});
