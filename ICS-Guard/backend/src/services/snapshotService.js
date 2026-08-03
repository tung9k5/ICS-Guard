import { Device, SystemMetadata } from '../models/index.js';
import { calculateCanonicalChecksum } from '../config/constants.js';
import socketService from './socketService.js';

export { calculateCanonicalChecksum };

const getSnapshotMarker = async (runtimeId) => {
  const marker = await SystemMetadata.findById(`snapshot:${runtimeId}`).lean();
  return marker?.value || { generation: 0, revision: 0 };
};

const isNewerSnapshot = (generation, revision, marker) => (
  generation > Number(marker.generation || 0)
  || (
    generation === Number(marker.generation || 0)
    && revision > Number(marker.revision || 0)
  )
);

const validateSnapshotEnvelope = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new TypeError('Snapshot envelope must be an object.');
  }
  const {
    runtime_id: runtimeId,
    runtime_generation: generation,
    snapshot_revision: revision,
    snapshot_complete: complete,
    record_count: recordCount,
    checksum,
    devices,
  } = snapshot;

  if (!runtimeId || typeof runtimeId !== 'string' || !/^[A-Za-z0-9._:-]+$/.test(runtimeId)) {
    throw new TypeError('runtime_id is invalid.');
  }
  if (!Number.isSafeInteger(generation) || generation < 1) {
    throw new TypeError('runtime_generation must be a positive integer.');
  }
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new TypeError('snapshot_revision must be a positive integer.');
  }
  if (complete !== true || !Array.isArray(devices) || devices.length !== recordCount) {
    throw new TypeError('Only complete snapshots with a matching record_count are accepted.');
  }
  if (typeof checksum !== 'string' || !/^[a-f0-9]{64}$/.test(checksum)) {
    throw new TypeError('checksum must be a lowercase SHA-256 hex string.');
  }

  const ids = new Set();
  for (const device of devices) {
    const deviceId = device?.device_id || device?._id;
    if (!deviceId || typeof deviceId !== 'string' || !/^[A-Za-z0-9._:-]+$/.test(deviceId)) {
      throw new TypeError('Every snapshot device must have a valid device_id.');
    }
    if (ids.has(deviceId)) {
      throw new TypeError(`Duplicate device_id '${deviceId}' in full snapshot.`);
    }
    ids.add(deviceId);
  }
};

/**
 * Validates and processes incoming Hardware Full Snapshot
 */
export const applyHardwareSnapshot = async (snapshot) => {
  try {
    validateSnapshotEnvelope(snapshot);
    const {
      runtime_id,
      runtime_generation,
      snapshot_revision,
      record_count,
      checksum,
      devices,
    } = snapshot;

    const expectedChecksum = calculateCanonicalChecksum(snapshot);
    if (checksum !== expectedChecksum) {
      console.warn(`[SnapshotService] Checksum mismatch for ${runtime_id} (Got ${checksum}, Expected ${expectedChecksum}). Rejected.`);
      return false;
    }

    const lastApplied = await getSnapshotMarker(runtime_id);
    if (!isNewerSnapshot(runtime_generation, snapshot_revision, lastApplied)) {
      console.info(`[SnapshotService] Stale snapshot revision (${runtime_generation}:${snapshot_revision} <= ${lastApplied.generation}:${lastApplied.revision}). Skipped.`);
      return true;
    }

    const snapshotDeviceIds = [];
    const operations = [];
    for (const dev of devices) {
      const extId = dev.external_device_id || dev.device_id || dev._id;
      const deviceId = dev.device_id || dev._id || extId;
      snapshotDeviceIds.push(deviceId);
      const operationalStatus = dev.operational_status || dev.status || 'active';
      operations.push({
        updateOne: {
          filter: { _id: deviceId },
          update: {
            $set: {
            source_id: runtime_id,
            source_type: 'hardware-simulator',
            external_device_id: extId,
            name: dev.name || deviceId,
            type: dev.type || 'sensor',
            zone: dev.zone || 'purdue-l1',
            purdue_level: dev.purdue_level || 'L1',
            parent_id: dev.parent_id || null,
            ipAddress: dev.ip_address || dev.ipAddress || '192.168.1.10',
            macAddress: dev.mac_address || dev.macAddress || '00:00:00:00:00:00',
            operational_status: operationalStatus,
            status: operationalStatus,
            updatedAt: new Date()
            },
            $setOnInsert: {
              security_status: 'normal',
            },
          },
          upsert: true,
        },
      });
    }

    if (operations.length > 0) {
      await Device.bulkWrite(operations, { ordered: true });
    }

    await Device.updateMany(
      {
        source_id: runtime_id,
        _id: { $nin: snapshotDeviceIds },
        status: { $ne: 'decommissioned' }
      },
      {
        $set: {
          operational_status: 'decommissioned',
          status: 'decommissioned',
          updatedAt: new Date()
        }
      }
    );

    await SystemMetadata.findByIdAndUpdate(
      `snapshot:${runtime_id}`,
      {
        $set: {
          value: {
            generation: runtime_generation,
            revision: snapshot_revision,
            record_count,
            checksum,
            applied_at: new Date().toISOString(),
          },
        },
      },
      { upsert: true, new: true }
    );

    console.log(`[SnapshotService] Applied Full Snapshot for ${runtime_id} (Rev ${runtime_generation}:${snapshot_revision}, ${devices.length} assets).`);

    // Broadcast inventory update via Socket.IO
    const io = socketService.getIo();
    if (io) {
      io.emit('INVENTORY_SYNC', { runtime_id, snapshot_revision, record_count });
    }

    return true;
  } catch (error) {
    console.error('[SnapshotService] Failed to apply snapshot:', error);
    return false;
  }
};

export default {
  applyHardwareSnapshot,
  calculateCanonicalChecksum
};
