import { calculateCanonicalChecksum } from '../src/config/constants.js';

describe('Golden Checksum Parity Unit Tests (Node.js & Python Contract)', () => {
  const goldenSnapshotSample = {
    runtime_id: 'hardware-01',
    runtime_boot_id: '8f27a4b0-31c1-4f91-9e2d-123456789abc',
    runtime_generation: 1,
    snapshot_revision: 5,
    snapshot_complete: true,
    record_count: 2,
    devices: [
      {
        device_id: 'plc-water-01',
        external_device_id: 'plc-water-01',
        name: 'Trạm PLC Xử Lý Nước Tự Động',
        type: 'controller',
        zone: 'purdue-l1',
        purdue_level: 'L1',
        parent_id: null,
        ip_address: '192.168.1.50',
        mac_address: '00:1A:2B:3C:4D:5E',
        operational_status: 'active',
        security_status: 'normal',
        created_at: '2026-07-27T10:00:00Z',
        updated_at: '2026-07-27T10:05:00Z'
      },
      {
        device_id: 'sensor-flow-01',
        external_device_id: 'sensor-flow-01',
        name: 'Cảm Biến Lưu Lượng Nước Vào',
        type: 'sensor',
        zone: 'purdue-l1',
        purdue_level: 'L1',
        parent_id: 'plc-water-01',
        ip_address: '192.168.1.51',
        mac_address: '00:1A:2B:3C:4D:5F',
        operational_status: 'active',
        security_status: 'normal',
        created_at: '2026-07-27T10:00:00Z',
        updated_at: '2026-07-27T10:05:00Z'
      }
    ]
  };

  test('1. Checksum should be a valid 64-character hex string', () => {
    const hash = calculateCanonicalChecksum(goldenSnapshotSample);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('2. Checksum should ignore existing checksum field in object', () => {
    const payloadWithChecksum = {
      ...goldenSnapshotSample,
      checksum: 'dummy-checksum-should-be-ignored'
    };
    const hash1 = calculateCanonicalChecksum(goldenSnapshotSample);
    const hash2 = calculateCanonicalChecksum(payloadWithChecksum);

    expect(hash1).toBe(hash2);
  });

  test('3. Key order variation should result in identical SHA-256 hash', () => {
    const permutedSample = {
      snapshot_complete: true,
      snapshot_revision: 5,
      runtime_generation: 1,
      record_count: 2,
      runtime_boot_id: '8f27a4b0-31c1-4f91-9e2d-123456789abc',
      runtime_id: 'hardware-01',
      devices: goldenSnapshotSample.devices
    };

    const hashOriginal = calculateCanonicalChecksum(goldenSnapshotSample);
    const hashPermuted = calculateCanonicalChecksum(permutedSample);

    expect(hashOriginal).toBe(hashPermuted);
  });

  test('4. Device order variation should result in an identical hash', () => {
    const reversed = {
      ...goldenSnapshotSample,
      devices: [...goldenSnapshotSample.devices].reverse(),
    };
    expect(calculateCanonicalChecksum(reversed))
      .toBe(calculateCanonicalChecksum(goldenSnapshotSample));
  });

  test('5. UTF-8/NFC golden vector should remain stable across runtimes', () => {
    const vector = {
      runtime_id: 'hardware-01',
      runtime_generation: 1,
      snapshot_revision: 1,
      snapshot_complete: true,
      record_count: 1,
      devices: [{
        device_id: 'pump-01',
        name: 'Máy bơm',
        operational_status: 'active',
      }],
    };
    expect(calculateCanonicalChecksum(vector))
      .toBe('fab9d5d077a42d5c95977153e846e2815afee63447656986dd559819b9012681');

    const decomposedName = `Ma\u0301y bo\u031bm`;
    expect(calculateCanonicalChecksum({
      ...vector,
      devices: [{ ...vector.devices[0], name: decomposedName }],
    })).toBe(calculateCanonicalChecksum(vector));
  });
});
