import { createConnection } from 'net';
import { promises as dns } from 'dns';
import { config } from '../config/index.js';

export type NetworkResult = {
  host: string;
  pingOk: boolean;
  avgMs: number;
  ports: { port: number; ok: boolean; ms: number }[];
  dnsOk: boolean;
};

export async function checkTcpPort(host: string, port: number, timeout = 3000): Promise<{ ok: boolean; ms: number }> {
  const start = Date.now();
  return new Promise(resolve => {
    const socket = createConnection({ host, port, timeout }, () => {
      const ms = Date.now() - start;
      socket.destroy();
      resolve({ ok: true, ms });
    });
    socket.on('error', () => { socket.destroy(); resolve({ ok: false, ms: Date.now() - start }); });
    socket.on('timeout', () => { socket.destroy(); resolve({ ok: false, ms: timeout }); });
  });
}

export async function checkNetwork(hostArg?: string): Promise<NetworkResult> {
  const host = hostArg ?? config.cisServer;
  if (!host) throw new Error('CIS_SERVER is not configured');
  let dnsOk = true;
  try { await dns.lookup(host); } catch { try { await dns.lookup('google.com'); dnsOk = true; } catch { dnsOk = false; } }

  // quick tcp as ping replacement (ICMP needs admin)
  const pingCheck = await checkTcpPort(host, 3389, 2000);

  const ports: { port: number; ok: boolean; ms: number }[] = [];
  for (const p of config.cisPorts) {
    const r = await checkTcpPort(host, p);
    ports.push({ port: p, ok: r.ok, ms: r.ms });
  }

  return { host, pingOk: pingCheck.ok, avgMs: pingCheck.ms, ports, dnsOk };
}

// allow direct run: npx tsx src/services/networkCheck.ts
if (import.meta.url.endsWith('networkCheck.ts')) {
  checkNetwork().then(r => {
    console.log(JSON.stringify(r, null, 2));
    const fail = r.ports.filter(p => !p.ok);
    if (fail.length) console.log('WARN: Closed ports:', fail.map(f=>f.port).join(','));
  });
}