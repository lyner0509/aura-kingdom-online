import { Socket } from 'node:net';
import { config } from './config.js';
import { buildCgiPacket } from './exp-bonus-model.js';

/**
 * Sends a raw ASCII command to ZoneServer CGI (port 20060 by default).
 * Binary format: uint16LE(payloadLen) + uint16LE(cmdLen) + ASCII(key + ',' + cmd)
 */
export async function sendZoneServerCommand(cmd: string, timeoutMs: number = 3000): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    let settled = false;
    let received = Buffer.alloc(0);

    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    const finish = (err: Error | null, res?: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (err) reject(err);
      else resolve(res ?? '');
    };

    socket.setTimeout(timeoutMs);

    socket.on('timeout', () => {
      finish(new Error(`Koneksi ke ZoneServer CGI (${config.ZONE_CGI_HOST}:${config.ZONE_CGI_PORT}) timeout.`));
    });

    socket.on('error', (err) => {
      finish(new Error(`Gagal menghubungi ZoneServer CGI: ${err.message}`));
    });

    socket.on('data', (chunk) => {
      received = Buffer.concat([received, chunk]);
      if (received.length >= 4) {
        const strLen = received.readUInt16LE(2);
        if (received.length >= 4 + strLen) {
          const respText = received.toString('latin1', 4, 4 + strLen);
          finish(null, respText);
        }
      }
    });

    socket.on('close', () => {
      if (!settled) {
        if (received.length >= 4) {
          const strLen = received.readUInt16LE(2);
          const respText = received.toString('latin1', 4, Math.min(received.length, 4 + strLen));
          finish(null, respText);
        } else {
          finish(new Error('Koneksi ZoneServer ditutup sebelum menerima respons lengkap.'));
        }
      }
    });

    socket.connect(config.ZONE_CGI_PORT, config.ZONE_CGI_HOST, () => {
      const packet = buildCgiPacket(config.ZONE_CGI_KEY, cmd);
      socket.write(packet);
    });
  });
}

/**
 * Dispatches queued system mails in public.sys_mail_queue to MissionServer.
 * If receiverCharId is provided and > 0, dispatches only for that character.
 * If 0 or omitted, dispatches all pending 'New' mails.
 */
export async function triggerMailQueue(receiverCharId: number = 0): Promise<string> {
  const charId = receiverCharId > 0 ? receiverCharId : 0;
  return sendZoneServerCommand(`send_sys_mail_queue ${charId}`);
}

/**
 * Broadcasts an announcement message across the entire game server via ZoneServer.
 */
export async function sendAnnounce(message: string): Promise<string> {
  const clean = message.replace(/[\r\n\t]/g, ' ').trim();
  return sendZoneServerCommand(`announce ${clean}`);
}
