import { useEffect, useRef, useState } from 'react';
import type { ClassificationExperiment } from '@sci/schema';
import { PRIVACY_NOTE, READ_FAIL_MESSAGE, readIndicatorColor, type ColorReading } from './colorRead';

type CameraState = 'off' | 'starting' | 'on' | 'unavailable';
const MAX_SIDE = 320;

export type ReadSource = 'camera' | 'file';

/** "AI 색 읽기": 카메라나 사진 파일의 가운데 영역 평균색을 지시약 색표와 비교한다. 프레임은 이 기기 안에서만 처리하고 어디에도 저장하지 않는다. */
export function ColorReader({
  exp,
  indicator,
  onIndicator,
  onReading,
}: {
  exp: ClassificationExperiment;
  indicator: string;
  onIndicator: (key: string) => void;
  onReading: (r: ColorReading, source: ReadSource) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(false);
  const [camera, setCamera] = useState<CameraState>('off');
  const [reading, setReading] = useState<ColorReading | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  // 화면을 벗어나거나(언마운트, 단원 바꾸기) 탭이 가려지면 카메라를 끈다.
  useEffect(() => {
    mountedRef.current = true;
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        stopStream();
        setCamera((c) => (c === 'on' || c === 'starting' ? 'off' : c));
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', onHide);
      stopStream();
    };
  }, []);

  useEffect(() => {
    if (camera === 'on' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play?.().catch(() => {});
    }
  }, [camera]);

  const startCamera = async () => {
    setMessage(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera('unavailable');
      return;
    }
    setCamera('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      setCamera('on');
    } catch {
      if (mountedRef.current) setCamera('unavailable');
    }
  };

  const stopCamera = () => {
    stopStream();
    setCamera('off');
  };

  const finish = (source: ReadSource, canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('canvas 2d를 쓸 수 없습니다.');
    const { width, height } = canvas;
    const img = ctx.getImageData(0, 0, width, height);
    const r = readIndicatorColor(exp, indicator, img.data, width, height);
    // 캔버스는 읽은 즉시 비운다. 프레임을 남기지 않는다.
    canvas.width = 0;
    canvas.height = 0;
    onReading(r, source);
    if (r.confident) {
      setReading(r);
      setMessage(null);
    } else {
      setReading(null);
      setMessage(READ_FAIL_MESSAGE);
    }
  };

  const readFrame = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setReading(null);
      setMessage(READ_FAIL_MESSAGE);
      return;
    }
    try {
      const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
      finish('camera', canvas);
    } catch (e) {
      console.error(e);
      setReading(null);
      setMessage(READ_FAIL_MESSAGE);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('사진을 열지 못했어요.'));
        el.src = url;
      });
      const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
      if (mountedRef.current) finish('file', canvas);
    } catch (err) {
      console.error(err);
      if (mountedRef.current) {
        setReading(null);
        setMessage(READ_FAIL_MESSAGE);
      }
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  return (
    <section className="panel reader" aria-label="AI 색 읽기">
      <h2>AI 색 읽기</h2>
      <p className="hint">실물 실험에서 나온 색을 카메라로 읽어 지시약 색과 비교해 봐요. (가상 시험 결과에는 넣지 않아요.)</p>
      <label className="reader-pick">
        읽을 지시약
        <select value={indicator} onChange={(e) => onIndicator(e.target.value)}>
          {exp.indicators.map((i) => (
            <option key={i.key} value={i.key}>
              {i.label}
            </option>
          ))}
        </select>
      </label>

      {camera === 'on' || camera === 'starting' ? (
        <div className="camera">
          <video ref={videoRef} playsInline muted aria-label="카메라 미리보기" />
          <div className="roi-guide" aria-hidden="true" />
        </div>
      ) : null}

      <div className="reader-actions">
        {camera === 'on' || camera === 'starting' ? (
          <>
            <button type="button" className="run" disabled={camera !== 'on'} onClick={readFrame}>
              이 색 읽기
            </button>
            <button type="button" onClick={stopCamera}>
              카메라 끄기
            </button>
          </>
        ) : (
          <button type="button" onClick={() => void startCamera()}>
            카메라 켜기
          </button>
        )}
        <label className="file-btn">
          사진 고르기
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => void onFile(e)} />
        </label>
      </div>
      {camera === 'unavailable' && <p className="hint">카메라를 쓸 수 없어요. 사진 고르기를 이용해 주세요.</p>}
      <p className="hint">{PRIVACY_NOTE}</p>
      <div className="reader-result" aria-live="polite">
        {reading && (
          <p>
            가장 가까운 색: <strong>{reading.bestLabel}</strong> (닮은 정도: {reading.similarity})
          </p>
        )}
        {message && <p>{message}</p>}
      </div>
    </section>
  );
}
