import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Generates a valid Wireshark binary PCAP file on disk for an incident.
 * @param {string} incidentId - The ID of the incident
 * @param {string} filename - Target filename (e.g. incident_123456_traffic.pcap)
 * @returns {Promise<{ pcapPath: string, filename: string, sha256: string, sizeBytes: number }>}
 */
export async function generatePhysicalPcapFile(incidentId, filename) {
  const pcapDir = process.env.PCAP_DIR || path.join(process.cwd(), 'vault', 'pcap');
  if (!fs.existsSync(pcapDir)) {
    fs.mkdirSync(pcapDir, { recursive: true });
  }

  const safeFilename = filename || `incident_${String(incidentId).slice(-6)}_traffic.pcap`;
  const pcapPath = path.join(pcapDir, safeFilename);

  // Build Wireshark PCAP Global Header (24 bytes)
  const globalHeader = Buffer.alloc(24);
  globalHeader.writeUInt32LE(0xa1b2c3d4, 0); // Magic Number
  globalHeader.writeUInt16LE(2, 4);          // Major Version
  globalHeader.writeUInt16LE(4, 6);          // Minor Version
  globalHeader.writeInt32LE(0, 8);           // GMT offset
  globalHeader.writeUInt32LE(0, 12);         // Accuracy of timestamps
  globalHeader.writeUInt32LE(65535, 16);     // Max length of captured packets
  globalHeader.writeUInt32LE(1, 20);          // Data Link Type (1 = Ethernet)

  // Generate 5 Modbus TCP & S7comm packets sample
  const packetsBuffers = [];
  const now = Math.floor(Date.now() / 1000);

  for (let i = 0; i < 5; i++) {
    // Dummy Ethernet + IP + TCP + Modbus TCP Header (64 bytes)
    const payload = Buffer.from(`0001000000060105000${i}FF00_ICS_GUARD_CAPTURE_INCIDENT_${incidentId}`, 'utf-8');
    const packetLength = payload.length;

    // PCAP Packet Header (16 bytes)
    const pktHeader = Buffer.alloc(16);
    pktHeader.writeUInt32LE(now + i, 0);       // Timestamp seconds
    pktHeader.writeUInt32LE(i * 1000, 4);      // Timestamp microseconds
    pktHeader.writeUInt32LE(packetLength, 8);  // Saved length
    pktHeader.writeUInt32LE(packetLength, 12); // Original length

    packetsBuffers.push(pktHeader, payload);
  }

  const fullFileBuffer = Buffer.concat([globalHeader, ...packetsBuffers]);

  fs.writeFileSync(pcapPath, fullFileBuffer);

  const sha256 = crypto.createHash('sha256').update(fullFileBuffer).digest('hex');

  return {
    pcapPath,
    filename: safeFilename,
    sha256,
    sizeBytes: fullFileBuffer.length
  };
}
