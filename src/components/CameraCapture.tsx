import { useEffect, useRef, useState } from 'react';
import { X, AlertCircle, CheckCircle2 } from 'lucide-react';

// Câmera in-browser (getUserMedia). Abre a câmera direto no app sem sair dele,
// evitando o reload causado por capture="environment" no Android Chrome.
// Componente compartilhado por Ferramentas, Frota e Materiais.
export function CameraCapture({ onCapture, onClose }: { onCapture: (file: File) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);

  useEffect(() => {
    let mounted = true;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (err: any) {
        if (!mounted) return;
        const msg = err?.name === 'NotAllowedError'
          ? 'Permissão de câmera negada. Libere nas configurações do navegador.'
          : 'Não foi possível acessar a câmera neste dispositivo.';
        setCamError(msg);
      }
    };
    startCamera();
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const stopStream = () => streamRef.current?.getTracks().forEach(t => t.stop());

  const handleCapture = () => {
    if (!videoRef.current || !ready) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' });
      stopStream();
      setCapturedFile(file);
      setCaptured(URL.createObjectURL(blob));
    }, 'image/jpeg', 0.88);
  };

  const handleConfirm = () => {
    if (capturedFile) { onCapture(capturedFile); if (captured) URL.revokeObjectURL(captured); }
  };

  const handleRetake = () => {
    if (captured) URL.revokeObjectURL(captured);
    setCaptured(null);
    setCapturedFile(null);
    setReady(false);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().then(() => setReady(true)); }
      })
      .catch(() => setCamError('Não foi possível reiniciar a câmera.'));
  };

  const handleClose = () => { stopStream(); if (captured) URL.revokeObjectURL(captured); onClose(); };

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col" style={{ touchAction: 'none' }}>
      <div className="flex items-center justify-between p-4 shrink-0">
        <button type="button" onClick={handleClose} className="p-2 text-white hover:bg-white/10 rounded-xl transition-colors">
          <X className="w-6 h-6" />
        </button>
        <span className="text-white text-sm font-bold uppercase tracking-widest">{captured ? 'Confirmar Foto' : 'Tirar Foto'}</span>
        <div className="w-10" />
      </div>

      <div className="flex-1 relative overflow-hidden bg-black">
        {camError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-400" />
            <p className="text-white text-sm">{camError}</p>
            <button type="button" onClick={handleClose} className="px-6 py-3 bg-white text-black rounded-xl font-bold text-sm">Fechar</button>
          </div>
        ) : captured ? (
          <img src={captured} className="w-full h-full object-contain" alt="Captura" />
        ) : (
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        )}
      </div>

      <div className="shrink-0 flex items-center justify-center gap-6 p-8 bg-black">
        {captured ? (
          <>
            <button type="button" onClick={handleRetake}
              className="flex-1 py-4 rounded-2xl border-2 border-white/20 text-white font-bold text-sm hover:bg-white/10 transition-all">
              Tirar Novamente
            </button>
            <button type="button" onClick={handleConfirm}
              className="flex-1 py-4 rounded-2xl bg-white text-black font-bold text-sm hover:bg-zinc-100 transition-all flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> Usar Esta Foto
            </button>
          </>
        ) : (
          <button type="button" onClick={handleCapture} disabled={!ready}
            className="w-20 h-20 rounded-full bg-white border-4 border-zinc-400 shadow-2xl hover:scale-95 active:scale-90 transition-transform disabled:opacity-40"
            aria-label="Capturar foto"
          />
        )}
      </div>
    </div>
  );
}
