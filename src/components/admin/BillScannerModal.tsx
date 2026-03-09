import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCcw, Smartphone, X, CheckCircle2, RotateCcw } from 'lucide-react';

interface BillScannerModalProps {
  onClose: () => void;
  onCaptured: (file: File) => void;
}

export default function BillScannerModal({ onClose, onCaptured }: BillScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isStarting, setIsStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startStream = async (mode: 'environment' | 'user') => {
    stopStream();
    setIsStarting(true);
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera is not supported in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsStarting(false);
    } catch (streamError) {
      setIsStarting(false);
      setError((streamError as Error).message || 'Unable to access camera');
    }
  };

  useEffect(() => {
    startStream(facingMode);
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setError('Camera is still initializing. Please try again.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Unable to capture image from camera.');
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError('Unable to generate image file.');
          return;
        }
        const file = new File([blob], `bill-scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setCapturedFile(file);
        setCapturedPreview(URL.createObjectURL(blob));
        stopStream();
      },
      'image/jpeg',
      0.92
    );
  };

  const retake = () => {
    if (capturedPreview) {
      URL.revokeObjectURL(capturedPreview);
    }
    setCapturedPreview(null);
    setCapturedFile(null);
    startStream(facingMode);
  };

  const useCaptured = () => {
    if (!capturedFile) return;
    onCaptured(capturedFile);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] p-3 sm:p-5 flex items-center justify-center" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[94dvh] overflow-hidden rounded-3xl border border-[#d8e8ff] bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-[#e5efff] bg-gradient-to-r from-[#f3f8ff] to-white">
          <div>
            <p className="text-sm font-semibold text-slate-800">Scan Medical Bill</p>
            <p className="text-xs text-slate-500">Capture clearly. Keep full bill visible and avoid shadows.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-white hover:text-slate-800" aria-label="Close scanner">
            <X size={16} />
          </button>
        </div>

        <div className="grid lg:grid-cols-[1.6fr_1fr] gap-0">
          <div className="p-3 sm:p-4 bg-[#0f172a]">
            <div className="relative w-full h-[44vh] sm:h-[58vh] rounded-2xl overflow-hidden border border-white/20 bg-black">
              {!capturedPreview ? (
                <>
                  <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
                  <div className="absolute inset-4 border-2 border-dashed border-white/70 rounded-xl pointer-events-none" />
                  {isStarting && (
                    <div className="absolute inset-0 grid place-items-center text-white text-sm bg-black/35">Starting camera...</div>
                  )}
                </>
              ) : (
                <img src={capturedPreview} alt="Captured bill preview" className="w-full h-full object-cover" />
              )}
            </div>
          </div>

          <div className="p-4 sm:p-5 space-y-3 overflow-y-auto max-h-[94dvh]">
            <div className="rounded-xl border border-[#deebff] bg-[#f8fbff] p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-700">Tips for better OCR</p>
              <p>1. Place bill on flat surface with good light.</p>
              <p>2. Include full bill from top header to totals.</p>
              <p>3. Avoid blur, fingers, and folded edges.</p>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="grid grid-cols-1 gap-2">
              {!capturedPreview ? (
                <>
                  <button
                    type="button"
                    onClick={capture}
                    disabled={isStarting}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2d7ff9] text-white px-4 py-2.5 text-sm font-medium disabled:opacity-60"
                  >
                    <Camera size={16} /> Capture Bill
                  </button>
                  <button
                    type="button"
                    onClick={() => setFacingMode((mode) => (mode === 'environment' ? 'user' : 'environment'))}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#cfe0ff] bg-white px-4 py-2.5 text-sm text-[#1d5fc7]"
                  >
                    <RefreshCcw size={15} /> Switch Camera
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={useCaptured}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-2.5 text-sm font-medium"
                  >
                    <CheckCircle2 size={16} /> Use This Photo
                  </button>
                  <button
                    type="button"
                    onClick={retake}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#cfe0ff] bg-white px-4 py-2.5 text-sm text-[#1d5fc7]"
                  >
                    <RotateCcw size={15} /> Retake
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d8e6fa] bg-[#f8fbff] px-4 py-2.5 text-sm text-slate-700"
              >
                <Smartphone size={15} /> Choose From Device
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  onCaptured(file);
                  onClose();
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
