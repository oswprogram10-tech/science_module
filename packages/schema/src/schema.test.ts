import { describe, expect, it } from 'vitest';
import manifestJson from '../../../content/units/g5-solution/manifest.json';
import { ManifestError, parseManifest } from './index';

describe('manifest schema', () => {
  it('실제 매니페스트가 검증을 통과한다', () => {
    const m = parseManifest(manifestJson);
    expect(m.id).toBe('g5-solution');
    expect(m.experiments[0]!.variables).toHaveLength(4);
    expect(m.experiments[0]!.tutor.probes).toHaveLength(7);
  });

  it('필수 필드가 없으면 거부한다', () => {
    const bad = JSON.parse(JSON.stringify(manifestJson));
    delete bad.experiments[0].question;
    expect(() => parseManifest(bad)).toThrow(ManifestError);
  });

  it('default가 options에 없으면 거부한다', () => {
    const bad = JSON.parse(JSON.stringify(manifestJson));
    bad.experiments[0].variables[1].default = 999;
    expect(() => parseManifest(bad)).toThrow(ManifestError);
  });

  it('알 수 없는 probe 시점과 빈 experiments를 거부한다', () => {
    const bad = JSON.parse(JSON.stringify(manifestJson));
    bad.experiments[0].tutor.probes[0].when = 'nope';
    expect(() => parseManifest(bad)).toThrow(ManifestError);
    expect(() => parseManifest({ ...manifestJson, experiments: [] })).toThrow(ManifestError);
    expect(() => parseManifest(null)).toThrow(ManifestError);
  });
});
