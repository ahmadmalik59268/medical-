import React, { useEffect, useRef, useState } from 'react';
import { Camera, Keyboard, ScanBarcode, TriangleAlert, Volume2, X } from 'lucide-react';
import { AppLanguageMode, Medicine } from '../types/pharmacy';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanCode: (code: string) => { ok: boolean; message: string };
  medicines: Medicine[];
  langMode: AppLanguageMode;
}

interface BarcodeDetectorLike {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanCode,
  medicines,
  langMode,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'active' | 'unsupported' | 'denied'>('idle');
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const lastScannedRef = useRef<{ code: string; ts: number }>({ code: '', ts: 0 });

  useEffect(() => {
    if (!isOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setCameraState('idle');
      setFeedback(null);
      return;
    }

    let cancelled = false;
    let rafId: number | null = null;

    async function startCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraState('unsupported');
        return;
      }
      setCameraState('starting');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraState('active');

        const DetectorCtor = (window as unknown as {
          BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
        }).BarcodeDetector;

        if (DetectorCtor && videoRef.current) {
          const detector = new DetectorCtor({
            formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
          });
          const scanLoop = async () => {
            if (cancelled || !videoRef.current) return;
            try {
              if (videoRef.current.readyState >= 2) {
                const results = await detector.detect(videoRef.current);
                if (results.length > 0 && results[0].rawValue) {
                  const code = results[0].rawValue.trim();
                  const now = Date.now();
                  if (code !== lastScannedRef.current.code || now - lastScannedRef.current.ts > 1600) {
                    lastScannedRef.current = { code, ts: now };
                    const res = onScanCode(code);
                    setFeedback(res);
                  }
                }
              }
            } catch {
              // Ignore transient frame detection errors
            }
            rafId = requestAnimationFrame(scanLoop);
          };
          rafId = requestAnimationFrame(scanLoop);
        }
      } catch {
        if (!cancelled) setCameraState('denied');
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, onScanCode]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualCode.trim();
    if (!trimmed) return;
    const res = onScanCode(trimmed);
    setFeedback(res);
    if (res.ok) setManualCode('');
  };

  // Pick 4 active items + Tobradex (expired lockout test) for one-click verification
  const quickSampleBarcodes = [
    medicines.find((m) => m.id === 'med-panadol-500'),
    medicines.find((m) => m.id === 'med-augmentin-625'),
    medicines.find((m) => m.id === 'med-risek-40'),
    medicines.find((m) => m.id === 'med-brufen-syrup'),
    medicines.find((m) => m.id === 'med-tobradex-drops'),
  ].filter(Boolean) as Medicine[];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/65 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Barcode Scanner"
    >
      <div className="w-full sm:max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <ScanBarcode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
                {langMode === 'ur' ? 'لائیو کیمرہ اور بار کوڈ اسکینر' : 'Live Camera & USB Barcode Scanner'}
              </h2>
              {langMode === 'bilingual' && (
                <p className="font-urdu text-xs text-slate-500 dark:text-slate-400" dir="rtl">
                  کیمرہ یا یو ایس بی اسکینر سے دوائی کا بار کوڈ اسکین کریں
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Camera Viewfinder */}
          <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-[16/9] border border-slate-800 flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraState === 'active' ? 'opacity-100' : 'opacity-0'}`}
            />

            {/* Reticle overlay when active */}
            {cameraState === 'active' && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="w-64 h-28 border-2 border-emerald-400/90 rounded-lg relative shadow-[0_0_0_9999px_rgba(2,6,23,0.45)]">
                  <div className="absolute left-2 right-2 top-1/2 h-0.5 bg-rose-500/90" />
                </div>
                <span className="mt-3 text-xs font-medium text-white bg-slate-900/80 px-3 py-1 rounded-md">
                  Align EAN-13 / Code-128 barcode inside frame
                </span>
              </div>
            )}

            {cameraState !== 'active' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-300">
                <Camera className="w-9 h-9 text-slate-400 mb-2" />
                <p className="text-sm font-medium text-white">
                  {cameraState === 'starting' && 'Initializing camera stream...'}
                  {cameraState === 'denied' && 'Camera permission not granted — use USB scanner or manual entry below'}
                  {cameraState === 'unsupported' && 'Browser camera unavailable — USB scanner & manual barcode entry active'}
                </p>
                <p className="font-urdu text-xs text-slate-400 mt-1" dir="rtl">
                  یو ایس بی بار کوڈ اسکینر یا نیچے دیے گئے کوڈ بٹن استعمال کریں
                </p>
              </div>
            )}
          </div>

          {/* Scan Feedback Banner */}
          {feedback && (
            <div
              className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm ${
                feedback.ok
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {feedback.ok ? (
                  <Volume2 className="w-4 h-4 shrink-0" />
                ) : (
                  <TriangleAlert className="w-4 h-4 shrink-0" />
                )}
                <span className="font-medium">{feedback.message}</span>
              </div>
            </div>
          )}

          {/* Manual / USB Keyboard-Wedge Entry */}
          <form onSubmit={handleManualSubmit} className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
              <Keyboard className="w-3.5 h-3.5" />
              <span>
                {langMode === 'ur'
                  ? 'بار کوڈ نمبر درج کریں یا یو ایس بی سے اسکین کریں'
                  : 'Enter Barcode / Scan with USB Laser Gun'}
              </span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="e.g. 8964001200015"
                autoFocus
                className="flex-1 h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-mono-num text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <button
                type="submit"
                className="h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium whitespace-nowrap shrink-0 transition-colors"
              >
                {langMode === 'ur' ? 'شامل کریں' : 'Add to Bill'}
              </button>
            </div>
          </form>

          {/* Instant Test Scan Buttons */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Quick Test Scan (Tap to simulate laser scan)</span>
              <span className="font-urdu" dir="rtl">فوری ٹیسٹ اسکین</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quickSampleBarcodes.map((med) => {
                const isExpiredSample = med.id === 'med-tobradex-drops';
                return (
                  <button
                    key={med.id}
                    type="button"
                    onClick={() => setFeedback(onScanCode(med.barcode))}
                    className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left transition-colors min-h-[44px] ${
                      isExpiredSample
                        ? 'border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-50 dark:hover:bg-rose-950/50'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {med.nameEn}
                      </div>
                      <div className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                        {med.barcode}
                        {isExpiredSample ? ' · Expired Test' : ''}
                      </div>
                    </div>
                    <ScanBarcode className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
