import { useState, useCallback, useRef, useEffect } from 'react';
import { deleteShard, createAdapter } from '@/api';
import { encodeZeroWidth, encodeImageStego, generateStegoImage, generateStegoFilename } from '@/crypto';
import type { ProviderConfig } from '@/api/provider-types';
import type { ReceiptVerification } from '@/hooks/use-create-note';
import { QrCode } from './QrCode';
import styles from './NoteLink.module.css';

const QR_EXPORT_SIZE = 512;

const STORAGE_KEY = 'notefade-base-url';

type DestroyState = 'idle' | 'confirming' | 'destroying' | 'destroyed';

interface NoteLinkProps {
  url: string;
  compactUrl?: string;
  expiresAt: number;
  shardId: string;
  providerConfig: ProviderConfig | null;
  password: string;
  onCreateAnother: () => void;
  readCount?: number;
  receiptVerification?: ReceiptVerification | null;
  decoyUrls?: string[];
}

function formatCountdown(diff: number): string {
  if (diff <= 0) return '0s';

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0)
    return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatDate(expiresAt: number): string {
  const date = new Date(expiresAt);
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function useCountdown(expiresAt: number): number {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, expiresAt - Date.now()),
  );

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, expiresAt - Date.now()));
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return remaining;
}

export function NoteLink({
  url,
  compactUrl,
  expiresAt,
  shardId,
  providerConfig,
  password,
  onCreateAnother,
  readCount = 1,
  receiptVerification,
  decoyUrls = [],
}: NoteLinkProps) {
  const remaining = useCountdown(expiresAt);
  const [copyState, setCopyState] = useState<'idle' | 'shown' | 'fading'>(
    'idle',
  );
  const [stegoText, setStegoText] = useState('');
  const [stegoResult, setStegoResult] = useState<string | null>(null);
  const [stegoCopied, setStegoCopied] = useState(false);
  const [stegoImage, setStegoImage] = useState<string | null>(null);
  const [stegoImageLoading, setStegoImageLoading] = useState(false);
  const [verificationCopied, setVerificationCopied] = useState(false);
  const [copiedDecoyIndex, setCopiedDecoyIndex] = useState<number | null>(null);
  const [receiptDownloaded, setReceiptDownloaded] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [pwCopied, setPwCopied] = useState<'idle' | 'shown' | 'fading'>('idle');
  const [destroyState, setDestroyState] = useState<DestroyState>('idle');
  const [destroyError, setDestroyError] = useState<string | null>(null);
  const [customBase, setCustomBase] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? '',
  );

  const pathname = window.location.pathname;
  const defaultBase = window.location.origin + pathname;

  const fragment = url.includes('#') ? url.slice(url.indexOf('#')) : '';
  const displayUrl = customBase
    ? customBase.replace(/\/+$/, '') + '/' + fragment
    : url;

  const handleCopy = useCallback(async () => {
    if (copyState !== 'idle') return;
    try {
      await navigator.clipboard.writeText(displayUrl);
    } catch {
      const input = document.createElement('input');
      input.value = displayUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setHasCopied(true);
    setConfirmingLeave(false);
    setCopyState('shown');
    setTimeout(() => setCopyState('fading'), 1200);
    setTimeout(() => setCopyState('idle'), 1600);
  }, [displayUrl, copyState]);

  const handleDestroy = useCallback(async () => {
    setDestroyState('destroying');
    setDestroyError(null);
    try {
      let deleted: boolean;
      if (providerConfig) {
        const adapter = createAdapter(providerConfig);
        deleted = await adapter.delete(shardId);
      } else {
        deleted = await deleteShard(shardId);
      }
      if (deleted) {
        setDestroyState('destroyed');
      } else {
        setDestroyState('idle');
        setDestroyError('note already read or expired');
      }
    } catch {
      setDestroyState('confirming');
      setDestroyError('failed to destroy — try again');
    }
  }, [shardId, providerConfig]);

  const isValidBaseUrl = (url: string): boolean => {
    if (!url) return true;
    return (
      url.startsWith('https://') ||
      url.startsWith('http://localhost') ||
      url.startsWith('http://127.0.0.1')
    );
  };

  const isCustom = Boolean(customBase) && customBase !== defaultBase;
  const isUnsafeBase = isCustom && !isValidBaseUrl(customBase);

  // For QR codes, use the compact (unpadded) URL when available
  const qrValue = (() => {
    if (!compactUrl) return displayUrl;
    // Apply custom base URL to the compact URL's fragment
    const compactFragment = compactUrl.includes('#') ? compactUrl.slice(compactUrl.indexOf('#')) : '';
    if (customBase) {
      return customBase.replace(/\/+$/, '') + '/' + compactFragment;
    }
    return compactUrl;
  })();

  const handleBaseChange = (value: string) => {
    setCustomBase(value);
    if (value) {
      localStorage.setItem(STORAGE_KEY, value);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleReset = () => {
    setCustomBase('');
    localStorage.removeItem(STORAGE_KEY);
    setSettingsOpen(false);
  };

  const copied = copyState !== 'idle';
  const needsReceipt = Boolean(receiptVerification) && !receiptDownloaded;

  const baseUrlInputRef = useRef<HTMLInputElement>(null);
  const linkBoxInnerRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<SVGSVGElement>(null);
  const [qrSize, setQrSize] = useState<number | null>(null);

  useEffect(() => {
    const el = linkBoxInnerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setQrSize(entry.contentRect.height + 30);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleDownloadQr = useCallback(() => {
    const svg = qrRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(QR_EXPORT_SIZE));
    clone.setAttribute('height', String(QR_EXPORT_SIZE));
    // Resolve CSS variables for standalone SVG rendering
    const cs = getComputedStyle(document.documentElement);
    const qrBg = cs.getPropertyValue('--qr-bg').trim();
    const qrMod = cs.getPropertyValue('--qr-module').trim();
    clone.querySelectorAll('rect').forEach((rect) => {
      const fill = rect.style.fill;
      if (fill.includes('--qr-bg')) rect.setAttribute('fill', qrBg);
      else if (fill.includes('--qr-module')) rect.setAttribute('fill', qrMod);
    });
    const svgData = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(svgUrl);
      const canvas = document.createElement('canvas');
      canvas.width = QR_EXPORT_SIZE;
      canvas.height = QR_EXPORT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, QR_EXPORT_SIZE, QR_EXPORT_SIZE);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const file = new File([blob], 'notefade-qr.png', { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          navigator.share({ files: [file] }).catch(() => {});
        } else {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'notefade-qr.png';
          a.click();
          URL.revokeObjectURL(a.href);
        }
      }, 'image/png');
    };
    img.src = svgUrl;
  }, []);

  useEffect(() => {
    if (settingsOpen) {
      baseUrlInputRef.current?.focus();
      baseUrlInputRef.current?.select();
    }
  }, [settingsOpen]);

  // Cleanup stego image object URL on unmount or when image changes
  useEffect(() => {
    return () => {
      if (stegoImage) URL.revokeObjectURL(stegoImage);
    };
  }, [stegoImage]);

  const stegoImageBlobRef = useRef<Blob | null>(null);
  const stegoFileRef = useRef<HTMLInputElement>(null);

  const handleGenerateStegoImage = useCallback(async () => {
    setStegoImageLoading(true);
    try {
      const blob = await generateStegoImage(displayUrl);
      stegoImageBlobRef.current = blob;
      if (stegoImage) URL.revokeObjectURL(stegoImage);
      setStegoImage(URL.createObjectURL(blob));
    } catch {
      // silently fail
    } finally {
      setStegoImageLoading(false);
    }
  }, [displayUrl, stegoImage]);

  const handleUploadStegoImage = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setStegoImageLoading(true);
    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = objectUrl;
      });
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No canvas context');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      encodeImageStego(imageData, displayUrl);
      ctx.putImageData(imageData, 0, 0);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
      });
      stegoImageBlobRef.current = blob;
      if (stegoImage) URL.revokeObjectURL(stegoImage);
      setStegoImage(URL.createObjectURL(blob));
    } catch {
      // silently fail
    } finally {
      setStegoImageLoading(false);
    }
  }, [displayUrl, stegoImage]);

  const handleDownloadStegoImage = useCallback(() => {
    const blob = stegoImageBlobRef.current;
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = generateStegoFilename();
    a.click();
    URL.revokeObjectURL(a.href);
  }, []);

  const handleDownloadStegoZip = useCallback(async () => {
    const blob = stegoImageBlobRef.current;
    if (!blob) return;
    const pngName = generateStegoFilename();
    const pngBytes = new Uint8Array(await blob.arrayBuffer());
    // Build a minimal ZIP (store, no compression) for a single file
    const nameBytes = new TextEncoder().encode(pngName);
    const nameLen = nameBytes.length;
    const fileSize = pngBytes.length;
    const now = new Date();
    const dosTime =
      ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
    const dosDate =
      ((((now.getFullYear() - 1980) & 0x7f) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;
    // CRC-32
    let crc = 0xffffffff;
    for (let i = 0; i < fileSize; i++) {
      crc ^= pngBytes[i];
      for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    crc ^= 0xffffffff;

    const localHeaderSize = 30 + nameLen;
    const centralHeaderSize = 46 + nameLen;
    const eocdSize = 22;
    const totalSize = localHeaderSize + fileSize + centralHeaderSize + eocdSize;
    const buf = new ArrayBuffer(totalSize);
    const view = new DataView(buf);
    const bytes = new Uint8Array(buf);
    let offset = 0;
    // Local file header
    view.setUint32(offset, 0x04034b50, true); offset += 4;
    view.setUint16(offset, 20, true); offset += 2; // version needed
    view.setUint16(offset, 0, true); offset += 2;  // flags
    view.setUint16(offset, 0, true); offset += 2;  // compression: store
    view.setUint16(offset, dosTime, true); offset += 2;
    view.setUint16(offset, dosDate, true); offset += 2;
    view.setUint32(offset, crc >>> 0, true); offset += 4;
    view.setUint32(offset, fileSize, true); offset += 4; // compressed
    view.setUint32(offset, fileSize, true); offset += 4; // uncompressed
    view.setUint16(offset, nameLen, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2; // extra field len
    bytes.set(nameBytes, offset); offset += nameLen;
    bytes.set(pngBytes, offset); offset += fileSize;
    // Central directory
    const centralOffset = offset;
    view.setUint32(offset, 0x02014b50, true); offset += 4;
    view.setUint16(offset, 20, true); offset += 2; // version made by
    view.setUint16(offset, 20, true); offset += 2; // version needed
    view.setUint16(offset, 0, true); offset += 2;  // flags
    view.setUint16(offset, 0, true); offset += 2;  // compression
    view.setUint16(offset, dosTime, true); offset += 2;
    view.setUint16(offset, dosDate, true); offset += 2;
    view.setUint32(offset, crc >>> 0, true); offset += 4;
    view.setUint32(offset, fileSize, true); offset += 4;
    view.setUint32(offset, fileSize, true); offset += 4;
    view.setUint16(offset, nameLen, true); offset += 2;
    view.setUint16(offset, 0, true); offset += 2; // extra
    view.setUint16(offset, 0, true); offset += 2; // comment
    view.setUint16(offset, 0, true); offset += 2; // disk start
    view.setUint16(offset, 0, true); offset += 2; // internal attrs
    view.setUint32(offset, 0, true); offset += 4;  // external attrs
    view.setUint32(offset, 0, true); offset += 4;  // local header offset
    bytes.set(nameBytes, offset); offset += nameLen;
    // End of central directory
    view.setUint32(offset, 0x06054b50, true); offset += 4;
    view.setUint16(offset, 0, true); offset += 2; // disk number
    view.setUint16(offset, 0, true); offset += 2; // central dir disk
    view.setUint16(offset, 1, true); offset += 2; // entries on disk
    view.setUint16(offset, 1, true); offset += 2; // total entries
    view.setUint32(offset, centralHeaderSize, true); offset += 4;
    view.setUint32(offset, centralOffset, true); offset += 4;
    view.setUint16(offset, 0, true); // comment length

    const zipBlob = new Blob([buf], { type: 'application/zip' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(zipBlob);
    a.download = pngName.replace(/\.png$/, '.zip');
    a.click();
    URL.revokeObjectURL(a.href);
  }, []);

  return (
    <div className={styles.container}>
      <h2
        className={
          destroyState === 'destroyed'
            ? styles.headingDestroyed
            : styles.heading
        }
      >
        <span className={styles.checkIcon}>
          {destroyState === 'destroyed' ? (
            <svg width='20' height='20' viewBox='0 0 20 20' fill='none'>
              <circle cx='10' cy='10' r='10' fill='rgba(239,68,68,0.12)' />
              <path
                d='M7 7l6 6M13 7l-6 6'
                stroke='rgba(239,68,68,0.85)'
                strokeWidth='1.5'
                strokeLinecap='round'
              />
            </svg>
          ) : (
            <svg width='20' height='20' viewBox='0 0 20 20' fill='none'>
              <circle cx='10' cy='10' r='10' fill='rgba(79,143,247,0.12)' />
              <path
                d='M6 10.5L8.5 13L14 7.5'
                stroke='#4f8ff7'
                strokeWidth='1.5'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          )}
        </span>
        {destroyState === 'destroyed'
          ? 'note securely destroyed'
          : fragment.startsWith('#protected:')
            ? <>
                <span className={styles.desktopOnly}>encrypted password protected note ready</span>
                <span className={styles.mobileOnly}>encrypted password note ready</span>
              </>
            : 'encrypted note ready'}
      </h2>
      <p className={styles.description}>
        {destroyState === 'destroyed'
          ? 'the link is now permanently invalid'
          : fragment.startsWith('#protected:')
            ? 'share this link and password — it works exactly once'
            : 'share this link — it works exactly once'}
      </p>

      {destroyState !== 'destroyed' && (
        <div className={styles.metaRow}>
          <div
            className={styles.expiryBadge}
            onClick={() =>
              navigator.clipboard.writeText(String(Math.floor(expiresAt / 1000)))
            }
            role='button'
            tabIndex={0}
            title='copy unix timestamp'
            style={{ cursor: 'pointer' }}
          >
            <svg
              className={styles.expiryIcon}
              width='12'
              height='12'
              viewBox='0 0 12 12'
              fill='none'
            >
              <circle
                cx='6'
                cy='6'
                r='5'
                stroke='currentColor'
                strokeWidth='1.2'
              />
              <path
                d='M6 3.5V6l2 1.5'
                stroke='currentColor'
                strokeWidth='1.2'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
            {remaining <= 0 ? (
              'expired'
            ) : (
              <span className={styles.expiryText}>
                self-destructs in (<span className={styles.countdown}>{formatCountdown(remaining)}</span>) at {formatDate(expiresAt)}
              </span>
            )}
          </div>

          {fragment.startsWith('#protected:') && password.length > 0 && (
            <div className={styles.passwordDisplay}>
              <span className={styles.passwordLabel}>password</span>
              <span className={styles.passwordText}>
                {showPw ? password : '\u2022'.repeat(Math.min(password.length, 20))}
              </span>
              <button
                type='button'
                className={styles.passwordAction}
                onClick={() => {
                  if (pwCopied !== 'idle') return;
                  navigator.clipboard.writeText(password);
                  setShowPw(false);
                  setPwCopied('shown');
                  setTimeout(() => setPwCopied('fading'), 1200);
                  setTimeout(() => setPwCopied('idle'), 1600);
                }}
                title={pwCopied !== 'idle' ? 'copied' : 'copy password'}
              >
                {pwCopied !== 'idle' ? (
                  <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
                    <path
                      d='M3 7.5L5.5 10L11 4.5'
                      stroke='#22c55e'
                      strokeWidth='1.5'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                    />
                  </svg>
                ) : (
                  <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
                    <rect
                      x='4.5'
                      y='4.5'
                      width='7'
                      height='7'
                      rx='1.5'
                      stroke='currentColor'
                      strokeWidth='1.2'
                    />
                    <path
                      d='M9.5 4.5V3a1.5 1.5 0 00-1.5-1.5H3A1.5 1.5 0 001.5 3v5A1.5 1.5 0 003 9.5h1.5'
                      stroke='currentColor'
                      strokeWidth='1.2'
                    />
                  </svg>
                )}
              </button>
              <button
                type='button'
                className={styles.passwordAction}
                onClick={() => setShowPw((prev) => !prev)}
                title={showPw ? 'hide password' : 'reveal password'}
              >
                {showPw ? (
                  <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
                    <path
                      d='M1.5 7s2.2-3.5 5.5-3.5S12.5 7 12.5 7s-2.2 3.5-5.5 3.5S1.5 7 1.5 7z'
                      stroke='currentColor'
                      strokeWidth='1.2'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                    />
                    <circle
                      cx='7'
                      cy='7'
                      r='1.8'
                      stroke='currentColor'
                      strokeWidth='1.2'
                    />
                  </svg>
                ) : (
                  <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
                    <path
                      d='M2 2l10 10M5.6 5.7a1.8 1.8 0 002.7 2.6'
                      stroke='currentColor'
                      strokeWidth='1.2'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                    />
                    <path
                      d='M4 4.3C2.7 5.2 1.5 7 1.5 7s2.2 3.5 5.5 3.5c1 0 1.9-.3 2.7-.8M9.5 9.2c1.5-1 2.9-2.7 3-2.7s-2.2-3.5-5.5-3.5c-.6 0-1.2.1-1.7.3'
                      stroke='currentColor'
                      strokeWidth='1.2'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                    />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {destroyState !== 'destroyed' && (
        <>
          <div className={styles.linkBox}>
            <div
              ref={linkBoxInnerRef}
              className={`${styles.linkBoxInner} ${copied ? styles.linkBoxCopied : ''}`}
              onClick={handleCopy}
              role='button'
              tabIndex={0}
            >
              <span className={styles.linkText}>
                {settingsOpen ? (
                  <>
                    <span className={styles.linkBase}>
                      {customBase
                        ? customBase.replace(/\/+$/, '') + '/'
                        : displayUrl.slice(0, displayUrl.indexOf('#'))}
                    </span>
                    {fragment}
                  </>
                ) : (
                  displayUrl
                )}
              </span>
              <div className={styles.linkActions}>
                <button
                  type='button'
                  className={styles.copyIcon}
                  onClick={handleCopy}
                  title={copied ? 'copied' : 'copy to clipboard'}
                >
                  {copied ? (
                    <svg width='16' height='16' viewBox='0 0 16 16' fill='none'>
                      <path
                        d='M3.5 8.5L6 11L12.5 4.5'
                        stroke='#22c55e'
                        strokeWidth='1.5'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                    </svg>
                  ) : (
                    <svg width='16' height='16' viewBox='0 0 16 16' fill='none'>
                      <rect
                        x='5.5'
                        y='5.5'
                        width='7'
                        height='7'
                        rx='1.5'
                        stroke='currentColor'
                        strokeWidth='1.2'
                      />
                      <path
                        d='M10.5 5.5V4a1.5 1.5 0 00-1.5-1.5H4A1.5 1.5 0 002.5 4v5A1.5 1.5 0 004 10.5h1.5'
                        stroke='currentColor'
                        strokeWidth='1.2'
                      />
                    </svg>
                  )}
                </button>
                <button
                  type='button'
                  className={`${styles.settingsIcon} ${settingsOpen ? styles.settingsIconActive : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSettingsOpen((prev) => {
                      if (prev) {
                        handleReset();
                      }
                      return !prev;
                    });
                  }}
                  title='change base URL'
                >
                  <svg width='14' height='14' viewBox='0 0 15 15' fill='none'>
                    <path
                      d='M7.07095 0.650238C6.67391 0.650238 6.32977 0.925096 6.24198 1.31231L6.0039 2.36247C5.6249 2.47269 5.26335 2.62363 4.92436 2.81013L4.01335 2.23585C3.67748 2.02413 3.23978 2.07312 2.95903 2.35386L2.35294 2.95996C2.0722 3.2407 2.0232 3.6784 2.23493 4.01427L2.80942 4.92561C2.62307 5.2645 2.47227 5.62589 2.36216 6.00472L1.31209 6.24287C0.924883 6.33065 0.650024 6.6748 0.650024 7.07183V7.92897C0.650024 8.32601 0.924883 8.67015 1.31209 8.75794L2.36228 8.99603C2.47246 9.375 2.62335 9.73652 2.80979 10.0755L2.2356 10.9867C2.02388 11.3225 2.07287 11.7602 2.35361 12.0409L2.95971 12.647C3.24045 12.9278 3.67815 12.9768 4.01402 12.7651L4.92537 12.1906C5.26429 12.377 5.62571 12.5278 6.00457 12.638L6.24265 13.6878C6.33043 14.075 6.67457 14.3499 7.07161 14.3499H7.92875C8.32579 14.3499 8.66993 14.075 8.75771 13.6878L8.99588 12.6376C9.37462 12.5275 9.73594 12.3767 10.0748 12.1904L10.9862 12.7651C11.3221 12.9768 11.7598 12.9278 12.0405 12.647L12.6466 12.0409C12.9274 11.7602 12.9764 11.3225 12.7646 10.9867L12.1904 10.0755C12.3768 9.73666 12.5275 9.37524 12.6376 8.99636L13.6878 8.75827C14.075 8.67049 14.3499 8.32635 14.3499 7.92931V7.07217C14.3499 6.67513 14.075 6.33099 13.6878 6.2432L12.6376 6.00513C12.5275 5.62629 12.3767 5.26491 12.1904 4.92598L12.7649 4.01453C12.9766 3.67866 12.9276 3.24096 12.6469 2.96022L12.0408 2.35412C11.76 2.07338 11.3223 2.02439 10.9865 2.23611L10.0751 2.81046C9.73622 2.62409 9.37484 2.47326 8.99602 2.36315L8.75791 1.31297C8.67012 0.925765 8.32598 0.650906 7.92895 0.650906L7.07095 0.650238ZM4.92053 4.92126C5.97631 3.86548 7.65891 3.72906 8.87069 4.58398C10.2267 5.54498 10.5765 7.41498 9.62552 8.78098C8.90457 9.80798 7.64917 10.2478 6.49805 9.9478C5.1726 9.60398 4.27266 8.35878 4.27266 6.99978C4.27266 6.22978 4.57266 5.26918 4.92053 4.92126Z'
                      fill='currentColor'
                      fillRule='evenodd'
                      clipRule='evenodd'
                    />
                  </svg>
                </button>
              </div>
              {copied && (
                <span
                  className={`${styles.copiedHint} ${copyState === 'fading' ? styles.copiedHintFading : ''}`}
                >
                  copied to clipboard
                </span>
              )}
            </div>

            {qrValue.length <= 2950 && (
              <div className={styles.qrSection} style={qrSize ? { width: qrSize, height: qrSize } : undefined}>
                <QrCode ref={qrRef} value={qrValue} className={styles.qrSvg} />
                <div className={styles.qrFooter}>
                  <span className={styles.qrLabel}>scan to open</span>
                  <button
                    type='button'
                    className={styles.qrDownload}
                    onClick={handleDownloadQr}
                    title='download QR as PNG'
                  >
                    <svg width='12' height='12' viewBox='0 0 12 12' fill='none'>
                      <path
                        d='M6 1.5v6M3.5 5L6 7.5 8.5 5'
                        stroke='currentColor'
                        strokeWidth='1.2'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                      <path
                        d='M2 9.5h8'
                        stroke='currentColor'
                        strokeWidth='1.2'
                        strokeLinecap='round'
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className={styles.shareRow}>
            <span className={styles.shareLabel}>share via</span>
            <div className={styles.shareIcons}>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(displayUrl)}`}
                target='_blank'
                rel='noopener noreferrer'
                className={styles.shareIcon}
                title='share via WhatsApp'
              >
                <svg width='16' height='16' viewBox='0 0 16 16' fill='none'>
                  <path d='M13.6 2.3A7.4 7.4 0 002.3 12.3L1 15l2.8-1.3a7.4 7.4 0 009.8-9.4zM8 14a6 6 0 01-3.2-.9l-.2-.1-2.2 1 1-2.1-.2-.3A6 6 0 118 14zm3.3-4.5c-.2-.1-1-.5-1.2-.6s-.3-.1-.4.1-.5.6-.6.7-.2.1-.4 0a5.4 5.4 0 01-2.5-2.2c-.2-.3.2-.3.5-1 0-.1 0-.2 0-.3l-.5-1c-.1-.3-.3-.2-.4-.2h-.3a.7.7 0 00-.5.2 1.9 1.9 0 00-.6 1.4c0 .9.6 1.7.7 1.8s1.2 1.9 3 2.6a9 9 0 001 .4 2.4 2.4 0 001.1.1c.3-.1 1-.4 1.2-.8s.1-.7.1-.8l-.4-.2z' fill='currentColor'/>
                </svg>
              </a>
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(displayUrl)}`}
                target='_blank'
                rel='noopener noreferrer'
                className={styles.shareIcon}
                title='share via Telegram'
              >
                <svg width='16' height='16' viewBox='0 0 16 16' fill='none'>
                  <path d='M14.3 1.7L1.4 6.8c-.5.2-.5.6 0 .7l3.3 1 1.3 4c.1.4.2.5.5.5s.3-.1.4-.2l1.8-1.8 3.3 2.4c.4.2.7.1.8-.4L14.9 2.5c.1-.6-.2-.9-.6-.8zM5.3 8.2l6.3-3.9-4.8 4.4-.2 2.1-1.3-2.6z' fill='currentColor'/>
                </svg>
              </a>
              <a
                href={`mailto:?subject=${encodeURIComponent('Private note')}&body=${encodeURIComponent(displayUrl)}`}
                className={styles.shareIcon}
                title='share via email'
              >
                <svg width='16' height='16' viewBox='0 0 16 16' fill='none'>
                  <rect x='2' y='3.5' width='12' height='9' rx='1.5' stroke='currentColor' strokeWidth='1.2' />
                  <path d='M2.5 4L8 8.5 13.5 4' stroke='currentColor' strokeWidth='1.2' strokeLinecap='round' strokeLinejoin='round' />
                </svg>
              </a>
              {typeof navigator.share === 'function' && (
                <button
                  type='button'
                  className={styles.shareIcon}
                  onClick={() => {
                    navigator.share({ title: 'notefade', url: displayUrl }).catch(() => {});
                  }}
                  title='share link'
                >
                  <svg width='16' height='16' viewBox='0 0 16 16' fill='none'>
                    <path
                      d='M4 10V12a1 1 0 001 1h6a1 1 0 001-1V10M8 2v7.5M5.5 4.5L8 2l2.5 2.5'
                      stroke='currentColor'
                      strokeWidth='1.2'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Steganographic sharing (Feature 7) */}
          <p className={styles.stegoLabel}>disguise your link with steganography</p>
          <div className={styles.stegoColumns}>
            <div className={styles.stegoColumn}>
              <div className={styles.stegoSection}>
                <p className={styles.stegoColumnLabel}>hide in text</p>
                <p className={styles.stegoDescription}>
                  some apps strip zero-width characters when pasting — if the recipient can't decode it, send the link directly instead
                </p>
                <div className={styles.stegoToggle}>
                  <input
                    type='text'
                    className={styles.stegoInput}
                    value={stegoText}
                    onChange={(e) => {
                      setStegoText(e.target.value);
                      setStegoResult(null);
                      setStegoCopied(false);
                    }}
                    placeholder='hide link in innocent text...'
                    spellCheck={false}
                  />
                  <button
                    type='button'
                    className={styles.stegoBtn}
                    onClick={() => {
                      if (stegoText.length < 2) return;
                      try {
                        const result = encodeZeroWidth(displayUrl, stegoText);
                        setStegoResult(result);
                      } catch {
                        setStegoResult(null);
                      }
                    }}
                    disabled={stegoText.length < 2}
                  >
                    encode
                  </button>
                </div>
                {stegoResult && (
                  <div
                    className={styles.stegoResult}
                    onClick={() => {
                      navigator.clipboard.writeText(stegoResult);
                      setStegoCopied(true);
                      setTimeout(() => setStegoCopied(false), 1500);
                    }}
                  >
                    <span>{stegoResult.replace(/[\u200B\u200C\u200D]/g, '')}</span>
                    <span className={styles.stegoHint}>
                      {stegoCopied ? 'copied' : 'click to copy — link is hidden in zero-width chars'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <span className={styles.stegoColumnsOr}>or</span>

            <div className={styles.stegoColumn}>
              <div className={styles.stegoImageSection}>
                <p className={styles.stegoColumnLabel}>hide in image</p>
                <p className={styles.stegoDescription}>
                  messengers like WhatsApp compress images and destroy hidden data — send as a ZIP file, or use your messenger's "send as document" / "original quality" mode to preserve the PNG intact
                </p>
                <div className={styles.stegoImageBtnRow}>
                  <button
                    type='button'
                    className={styles.stegoImageBtn}
                    onClick={handleGenerateStegoImage}
                    disabled={stegoImageLoading}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" />
                      <circle cx="5.5" cy="5.5" r="1.25" stroke="currentColor" strokeWidth="1" />
                      <path d="M2 11l3.5-3.5L8 10l2.5-3L14 11" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {stegoImageLoading ? 'generating...' : 'generate image'}
                  </button>
                  <button
                    type='button'
                    className={styles.stegoImageBtn}
                    onClick={() => stegoFileRef.current?.click()}
                    disabled={stegoImageLoading}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 10V3M5.5 5.5L8 3l2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M2.5 10v2.5a1 1 0 001 1h9a1 1 0 001-1V10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    upload image
                  </button>
                </div>
                <input
                  ref={stegoFileRef}
                  type='file'
                  accept='image/*'
                  className={styles.stegoFileInput}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadStegoImage(file);
                    e.target.value = '';
                  }}
                />
                {stegoImage && (
                  <div className={styles.stegoPreview}>
                    <img
                      src={stegoImage}
                      alt='steganographic image preview'
                      className={styles.stegoPreviewImg}
                    />
                    <div className={styles.stegoDownloadRow}>
                      <button
                        type='button'
                        className={styles.stegoDownloadBtn}
                        onClick={handleDownloadStegoImage}
                      >
                        <svg width='12' height='12' viewBox='0 0 12 12' fill='none'>
                          <path
                            d='M6 1.5v6M3.5 5L6 7.5 8.5 5'
                            stroke='currentColor'
                            strokeWidth='1.2'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                          />
                          <path
                            d='M2 9.5h8'
                            stroke='currentColor'
                            strokeWidth='1.2'
                            strokeLinecap='round'
                          />
                        </svg>
                        download PNG
                      </button>
                      <button
                        type='button'
                        className={styles.stegoDownloadBtn}
                        onClick={handleDownloadStegoZip}
                      >
                        <svg width='12' height='12' viewBox='0 0 12 12' fill='none'>
                          <path
                            d='M6 1.5v6M3.5 5L6 7.5 8.5 5'
                            stroke='currentColor'
                            strokeWidth='1.2'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                          />
                          <path
                            d='M2 9.5h8'
                            stroke='currentColor'
                            strokeWidth='1.2'
                            strokeLinecap='round'
                          />
                        </svg>
                        download ZIP
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Receipt verification download (Feature 6) */}
          {receiptVerification && (
            <div className={styles.receiptRow}>
              <button
                type='button'
                className={styles.receiptDownload}
                onClick={() => {
                  const blob = new Blob([JSON.stringify(receiptVerification, null, 2)], { type: 'application/json' });
                  const u = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = u;
                  a.download = 'notefade-receipt-verification.json';
                  a.click();
                  URL.revokeObjectURL(u);
                  setReceiptDownloaded(true);
                  setVerificationCopied(true);
                  setTimeout(() => setVerificationCopied(false), 1500);
                }}
              >
                {verificationCopied ? 'downloaded' : 'download receipt verification file'}
              </button>
              <span className={styles.receiptHint}>
                keep this file to verify proof of read later
              </span>
            </div>
          )}

          {/* Multi-read indicator */}
          {readCount > 1 && (
            <div className={styles.multiReadBadge}>
              this note can be read {readCount} times before it self-destructs
            </div>
          )}

          {/* Decoy URLs (Feature 8) */}
          {decoyUrls.length > 0 && (
            <div className={styles.decoySection}>
              <span className={styles.decoyLabel}>decoy links</span>
              {decoyUrls.map((dUrl, i) => (
                <div
                  key={i}
                  className={`${styles.decoyUrl} ${copiedDecoyIndex === i ? styles.decoyUrlCopied : ''}`}
                  onClick={() => {
                    navigator.clipboard.writeText(dUrl)
                    setCopiedDecoyIndex(i)
                    setTimeout(() => setCopiedDecoyIndex(null), 1500)
                  }}
                  title='click to copy'
                >
                  <span className={styles.decoyUrlText}>{dUrl}</span>
                  <span className={styles.decoyUrlHint}>
                    {copiedDecoyIndex === i ? 'copied' : 'click to copy'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {settingsOpen && (
            <div className={styles.settingsRow}>
              <label className={styles.settingsLabel}>
                custom frontend base url
              </label>
              <div className={styles.settingsInputRow}>
                <input
                  ref={baseUrlInputRef}
                  type='text'
                  className={`${styles.baseUrlInput} ${isUnsafeBase ? styles.baseUrlInputUnsafe : ''}`}
                  value={customBase || defaultBase}
                  onChange={(e) => handleBaseChange(e.target.value)}
                  onFocus={(e) => {
                    if (!customBase) {
                      setCustomBase(defaultBase);
                      localStorage.setItem(STORAGE_KEY, defaultBase);
                    }
                    e.target.select();
                  }}
                  spellCheck={false}
                />
                {customBase && (
                  <button
                    type='button'
                    className={styles.resetLink}
                    onClick={handleReset}
                    title='reset to default'
                  >
                    <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
                      <path
                        d='M1.5 1.5v4h4'
                        stroke='currentColor'
                        strokeWidth='1.3'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                      <path
                        d='M2.1 8.5a5 5 0 108.4-4.6A5 5 0 002.1 5.5L1.5 5.5'
                        stroke='currentColor'
                        strokeWidth='1.3'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                    </svg>
                  </button>
                )}
              </div>
              {isUnsafeBase && (
                <p className={styles.unsafeWarning}>
                  non-https base URL — links may not be secure
                </p>
              )}
            </div>
          )}
        </>
      )}

      {confirmingLeave && (
        <div className={styles.confirmBanner}>
          {!hasCopied && 'you haven\'t copied the link yet — it can\'t be recovered'}
          {!hasCopied && needsReceipt && <br />}
          {needsReceipt && 'you haven\'t downloaded the receipt — you won\'t be able to verify proof of read without it'}
        </div>
      )}

      <a
        href={pathname}
        className={
          confirmingLeave ? styles.anotherLinkDanger : styles.anotherLink
        }
        onClick={(e) => {
          e.preventDefault();
          if (destroyState !== 'destroyed' && !confirmingLeave && (!hasCopied || needsReceipt)) {
            setConfirmingLeave(true);
            return;
          }
          onCreateAnother();
        }}
      >
        {confirmingLeave ? 'leave anyway' : 'create another'}
      </a>

      {destroyState !== 'destroyed' && (
        <div className={styles.destroySection}>
          {destroyState === 'confirming' ? (
            <>
              <div className={styles.destroyBanner}>
                this will permanently invalidate the link
              </div>
              <div className={styles.destroyActions}>
                <button
                  type='button'
                  className={styles.destroyConfirmButton}
                  onClick={handleDestroy}
                >
                  confirm destroy
                </button>
                <button
                  type='button'
                  className={styles.destroyCancelButton}
                  onClick={() => {
                    setDestroyState('idle');
                    setDestroyError(null);
                  }}
                >
                  cancel
                </button>
              </div>
              {destroyError && (
                <p className={styles.destroyError}>{destroyError}</p>
              )}
            </>
          ) : destroyState === 'destroying' ? (
            <span className={styles.destroyButton} style={{ opacity: 0.5 }}>
              destroying...
            </span>
          ) : (
            <>
              <button
                type='button'
                className={styles.destroyButton}
                onClick={() => setDestroyState('confirming')}
              >
                destroy now
              </button>
              {destroyError && (
                <p className={styles.destroyError}>{destroyError}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
