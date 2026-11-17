import { PaperWidthChars, PrinterSettings } from '../types/pharmacy';
import { buildEscPosPayload, buildStructuredEscPosPayload, EscPosBlock } from './escPos';

export type PrintErrorCode =
  | 'permission'
  | 'not_found'
  | 'network'
  | 'timeout'
  | 'unsupported'
  | 'unknown';

export interface PrintResult {
  ok: boolean;
  errorCode?: PrintErrorCode;
  message: string;
  printerName?: string;
}

interface SerialPortLike {
  open: (options: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  writable?: WritableStream<Uint8Array>;
  getInfo?: () => { usbVendorId?: number; usbProductId?: number };
}

interface SerialNavigator extends Navigator {
  serial?: {
    getPorts: () => Promise<SerialPortLike[]>;
    requestPort: () => Promise<SerialPortLike>;
  };
}

interface BluetoothNavigator extends Navigator {
  bluetooth?: {
    requestDevice: (opts: {
      acceptAllDevices?: boolean;
      optionalServices?: string[];
    }) => Promise<{
      name?: string;
      gatt?: {
        connect: () => Promise<{
          getPrimaryServices: () => Promise<
            Array<{
              getCharacteristics: () => Promise<
                Array<{
                  properties: { write?: boolean; writeWithoutResponse?: boolean };
                  writeValue: (val: BufferSource) => Promise<void>;
                }>
              >;
            }>
          >;
          disconnect: () => void;
        }>;
      };
    }>;
  };
}

const DEFAULT_BLE_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Common BLE thermal printer service
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC / Sunmi / Xprinter BLE
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Keep remembered port/device references for the active session so auto-print never re-prompts
let activeSerialPort: SerialPortLike | null = null;

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean((navigator as SerialNavigator).serial);
}

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean((navigator as BluetoothNavigator).bluetooth);
}

export async function getPairedSerialPrinters(): Promise<Array<{ label: string; index: number }>> {
  const nav = navigator as SerialNavigator;
  if (!nav.serial) return [];
  try {
    const ports = await nav.serial.getPorts();
    return ports.map((p, idx) => {
      const info = p.getInfo ? p.getInfo() : {};
      const vid = info.usbVendorId ? `VID:${info.usbVendorId.toString(16).toUpperCase()}` : 'SPP/COM';
      return { label: `Thermal Printer (${vid} #${idx + 1})`, index: idx };
    });
  } catch {
    return [];
  }
}

export async function pairSerialPrinter(): Promise<PrintResult> {
  const nav = navigator as SerialNavigator;
  if (!nav.serial) {
    return {
      ok: false,
      errorCode: 'unsupported',
      message: 'USB/Bluetooth Serial is available in Chrome/Edge desktop or Android WebUSB. Use System Print Driver otherwise.',
    };
  }
  try {
    const port = await nav.serial.requestPort();
    activeSerialPort = port;
    const info = port.getInfo ? port.getInfo() : {};
    const label = info.usbVendorId
      ? `Thermal Printer (VID:${info.usbVendorId.toString(16).toUpperCase()})`
      : 'Paired Bluetooth/USB Printer';
    return { ok: true, message: `Selected ${label}`, printerName: label };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.toLowerCase().includes('no port selected') || msg.toLowerCase().includes('cancel')) {
      return { ok: false, errorCode: 'not_found', message: 'Koi printer select nahi hua.' };
    }
    return {
      ok: false,
      errorCode: 'permission',
      message: 'Printer permission nahi mili — browser dialog allow karein.',
    };
  }
}

async function sendViaSerial(
  payload: Uint8Array,
  baudRate: 9600 | 115200
): Promise<PrintResult> {
  const nav = navigator as SerialNavigator;
  if (!nav.serial) {
    return {
      ok: false,
      errorCode: 'unsupported',
      message: 'Browser does not support Web Serial. Switch to System Print Driver.',
    };
  }

  let port = activeSerialPort;
  if (!port) {
    const ports = await nav.serial.getPorts();
    if (ports.length > 0) port = ports[0];
  }
  if (!port) {
    return {
      ok: false,
      errorCode: 'not_found',
      message: 'Koi printer paired nahi hai — Print Sheet se printer select karein.',
    };
  }

  let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  let connectWatchdog: number | null = null;

  try {
    // 12-second connect watchdog so a switched-off printer never hangs indefinitely
    await Promise.race([
      port.open({ baudRate }),
      new Promise<never>((_, reject) => {
        connectWatchdog = window.setTimeout(() => {
          port?.close().catch(() => {});
          reject(new Error('CONNECT_TIMEOUT'));
        }, 12000);
      }),
    ]);
    if (connectWatchdog) window.clearTimeout(connectWatchdog);

    if (!port.writable) {
      return {
        ok: false,
        errorCode: 'network',
        message: 'Printer se raabta nahi hua — printer on hai aur cable/Bluetooth connected hai?',
      };
    }

    writer = port.writable.getWriter();
    await writer.write(payload);
    writer.releaseLock();
    writer = null;

    // Sleep ~400 ms before closing so the printer drains its hardware buffer completely
    await sleep(400);
    await port.close();

    return { ok: true, message: 'Receipt sent to thermal printer!' };
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    if (raw === 'CONNECT_TIMEOUT') {
      return {
        ok: false,
        errorCode: 'timeout',
        message: 'Printer se raabta nahi hua (12s timeout) — printer on hai aur paas hai?',
      };
    }
    return {
      ok: false,
      errorCode: 'network',
      message: 'Printer se raabta nahi hua — printer on hai aur paas hai?',
    };
  } finally {
    if (connectWatchdog) window.clearTimeout(connectWatchdog);
    try {
      writer?.releaseLock();
    } catch {
      // ignore
    }
    try {
      await port.close();
    } catch {
      // ignore
    }
  }
}

async function sendViaBle(payload: Uint8Array): Promise<PrintResult> {
  const nav = navigator as BluetoothNavigator;
  if (!nav.bluetooth) {
    return {
      ok: false,
      errorCode: 'unsupported',
      message: 'Web Bluetooth unavailable on this browser. Use System Print Driver or USB/Serial.',
    };
  }

  let watchdog: number | null = null;
  let serverDisconnect: (() => void) | null = null;

  try {
    const device = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: DEFAULT_BLE_SERVICES,
    });
    if (!device.gatt) {
      return {
        ok: false,
        errorCode: 'network',
        message: 'Selected Bluetooth device does not expose GATT print service.',
      };
    }

    const server = await Promise.race([
      device.gatt.connect(),
      new Promise<never>((_, reject) => {
        watchdog = window.setTimeout(() => reject(new Error('CONNECT_TIMEOUT')), 12000);
      }),
    ]);
    if (watchdog) window.clearTimeout(watchdog);
    serverDisconnect = () => server.disconnect();

    const services = await server.getPrimaryServices();
    let writableChar: { writeValue: (val: BufferSource) => Promise<void> } | null = null;
    for (const svc of services) {
      const chars = await svc.getCharacteristics();
      const found = chars.find((c) => c.properties.write || c.properties.writeWithoutResponse);
      if (found) {
        writableChar = found;
        break;
      }
    }

    if (!writableChar) {
      return {
        ok: false,
        errorCode: 'not_found',
        message: 'Bluetooth printer write channel nahi mila. Printer Classic SPP ho to Serial/System Driver use karein.',
      };
    }

    // Write in safe 100-byte BLE MTU chunks
    for (let offset = 0; offset < payload.length; offset += 100) {
      const chunk = payload.slice(offset, offset + 100);
      await writableChar.writeValue(chunk);
    }

    await sleep(400);
    server.disconnect();
    return {
      ok: true,
      message: `Printed on ${device.name || 'Bluetooth Printer'}`,
      printerName: device.name || 'BLE Printer',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'CONNECT_TIMEOUT') {
      return {
        ok: false,
        errorCode: 'timeout',
        message: 'Printer se raabta nahi hua — printer on hai aur paas hai?',
      };
    }
    return {
      ok: false,
      errorCode: 'network',
      message: 'Bluetooth print cancel ya fail ho gaya — dubara koshish karein.',
    };
  } finally {
    if (watchdog) window.clearTimeout(watchdog);
    try {
      serverDisconnect?.();
    } catch {
      // ignore
    }
  }
}

export function applyThermalPageRule(cssWidth: '58mm' | '80mm'): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--thermal-paper-width', cssWidth);
  let styleEl = document.getElementById('dynamic-print-page-style') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-print-page-style';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `@page { size: ${cssWidth} auto; margin: 0mm; }`;
}

export function resetBarcodePageRule(): void {
  if (typeof document === 'undefined') return;
  let styleEl = document.getElementById('dynamic-print-page-style') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-print-page-style';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `@page { size: auto; margin: 6mm; }`;
}

/**
 * Single PrintService door — every print path (sheet button, auto-print, reprint)
 * goes through here with a 35-second overall job timeout.
 */
export async function executePrintJob(
  settings: PrinterSettings,
  render: (widthChars: PaperWidthChars) => string | EscPosBlock[]
): Promise<PrintResult> {
  const widthChars = settings.paperWidthChars;

  if (settings.transport === 'browser') {
    const cssWidth = widthChars === 32 ? '58mm' : '80mm';
    applyThermalPageRule(cssWidth);
    window.print();
    return { ok: true, message: `Sent ${cssWidth} thermal slip to OS Print Dialog` };
  }

  const rendered = render(widthChars);
  const escPosBytes = Array.isArray(rendered)
    ? buildStructuredEscPosPayload(rendered)
    : buildEscPosPayload(rendered);

  const jobPromise =
    settings.transport === 'serial'
      ? sendViaSerial(escPosBytes, settings.baudRate)
      : sendViaBle(escPosBytes);

  // 35-second overall job timeout so a spinner never hangs forever
  return Promise.race([
    jobPromise,
    new Promise<PrintResult>((resolve) =>
      window.setTimeout(() => {
        resolve({
          ok: false,
          errorCode: 'timeout',
          message: 'Print job timed out (35s) — check printer power & paper roll.',
        });
      }, 35000)
    ),
  ]);
}
