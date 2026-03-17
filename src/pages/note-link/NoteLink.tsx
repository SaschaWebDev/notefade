import { useState, useCallback, useRef, useEffect } from 'react';
import { deleteShard, createAdapter } from '@/api';
import {
  encodeZeroWidth,
  encodeImageStego,
  generateStegoImage,
  generateStegoFilename,
} from '@/crypto';
import type { ProviderConfig } from '@/api/provider-types';
import type { ReceiptVerification } from '@/hooks/use-create-note';
import { QrCode } from '@/components/ui/qr-code';
import { MetaPill } from '@/components/ui/meta-pill';
import {
  IconDestroyedX,
  IconAliveCheck,
  IconClock,
  IconSunburst,
  IconLockSmall,
  IconReadCount,
  IconShieldCheck,
  IconGrid,
  IconCheck,
  IconClipboard,
  IconGear,
  IconDownload,
  IconWhatsApp,
  IconTelegram,
  IconEmail,
  IconShare,
  IconEye,
  IconEyeOff,
  IconImage,
  IconUpload,
  IconReset,
} from '@/components/ui/icons';
import {
  STORAGE_KEYS,
  COPY_FEEDBACK_MS,
  COPY_FLASH_FADE_MS,
  COPY_FLASH_DONE_MS,
  QR_CHAR_LIMIT,
  QR_EXPORT_SIZE,
  MIN_STEGO_TEXT_LENGTH,
  PROTECTED_PREFIX,
} from '@/constants';
import { formatCountdown, formatDate } from '@/utils/time';
import { buildZip } from '@/utils/zip';
import styles from './NoteLink.module.css';

const PASSWORD_MASK_MAX = 20;
const QR_HEIGHT_OFFSET = 30;

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
  barDurationLabel?: string;
  timeLockAt?: string;
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
  barDurationLabel,
  timeLockAt,
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
    () => localStorage.getItem(STORAGE_KEYS.BASE_URL) ?? '',
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
    setTimeout(() => setCopyState('fading'), COPY_FLASH_FADE_MS);
    setTimeout(() => setCopyState('idle'), COPY_FLASH_DONE_MS);
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
    const compactFragment = compactUrl.includes('#')
      ? compactUrl.slice(compactUrl.indexOf('#'))
      : '';
    if (customBase) {
      return customBase.replace(/\/+$/, '') + '/' + compactFragment;
    }
    return compactUrl;
  })();

  const handleBaseChange = (value: string) => {
    setCustomBase(value);
    if (value) {
      localStorage.setItem(STORAGE_KEYS.BASE_URL, value);
    } else {
      localStorage.removeItem(STORAGE_KEYS.BASE_URL);
    }
  };

  const handleReset = () => {
    setCustomBase('');
    localStorage.removeItem(STORAGE_KEYS.BASE_URL);
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
      if (entry) setQrSize(entry.contentRect.height + QR_HEIGHT_OFFSET);
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
    const svgBlob = new Blob([svgData], {
      type: 'image/svg+xml;charset=utf-8',
    });
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

  const handleUploadStegoImage = useCallback(
    async (file: File) => {
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
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
            'image/png',
          );
        });
        stegoImageBlobRef.current = blob;
        if (stegoImage) URL.revokeObjectURL(stegoImage);
        setStegoImage(URL.createObjectURL(blob));
      } catch {
        // silently fail
      } finally {
        setStegoImageLoading(false);
      }
    },
    [displayUrl, stegoImage],
  );

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
    const zipBlob = buildZip(pngName, pngBytes);
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
            <IconDestroyedX />
          ) : (
            <IconAliveCheck />
          )}
        </span>
        {destroyState === 'destroyed' ? (
          'note securely destroyed'
        ) : fragment.startsWith(`#${PROTECTED_PREFIX}`) ? (
          <>
            <span className={styles.desktopOnly}>
              encrypted password protected note ready
            </span>
            <span className={styles.mobileOnly}>
              encrypted password note ready
            </span>
          </>
        ) : (
          'encrypted note ready'
        )}
      </h2>
      <p className={styles.description}>
        {destroyState === 'destroyed'
          ? 'the link is now permanently invalid'
          : fragment.startsWith(`#${PROTECTED_PREFIX}`)
            ? 'share this link and password — it works exactly once'
            : 'share this link — it works exactly once'}
      </p>

      {destroyState !== 'destroyed' && (
        <div className={styles.metaRow}>
          <div
            className={styles.expiryBadge}
            onClick={() =>
              navigator.clipboard.writeText(
                String(Math.floor(expiresAt / 1000)),
              )
            }
            role='button'
            tabIndex={0}
            title='copy unix timestamp'
            style={{ cursor: 'pointer' }}
          >
            <IconClock className={styles.expiryIcon} />
            {remaining <= 0 ? (
              'expired'
            ) : (
              <span className={styles.expiryText}>
                self-destructs in (
                <span className={styles.countdown}>
                  {formatCountdown(remaining)}
                </span>
                ) at {formatDate(expiresAt)}
              </span>
            )}
          </div>

          {barDurationLabel && (
            <MetaPill href='/docs#auto-expiring' icon={<IconSunburst />}>
              fades after {barDurationLabel}
            </MetaPill>
          )}
          {timeLockAt && (
            <MetaPill href='/docs#time-lock' icon={<IconLockSmall />}>
              unlocks{' '}
              {new Date(timeLockAt).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </MetaPill>
          )}
          {readCount > 1 && (
            <MetaPill href='/docs#one-time-read' icon={<IconReadCount />}>
              {readCount}&times; reads
            </MetaPill>
          )}
          {receiptVerification && (
            <MetaPill href='/docs#proof-of-read' icon={<IconShieldCheck />}>
              proof of read
            </MetaPill>
          )}
          {decoyUrls.length > 0 && (
            <MetaPill href='/docs#decoy-links' icon={<IconGrid />}>
              {decoyUrls.length} decoy link{decoyUrls.length > 1 ? 's' : ''}
            </MetaPill>
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
                  {copied ? <IconCheck /> : <IconClipboard />}
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
                  <IconGear />
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

            {qrValue.length <= QR_CHAR_LIMIT && (
              <div
                className={styles.qrSection}
                style={qrSize ? { width: qrSize, height: qrSize } : undefined}
              >
                <QrCode ref={qrRef} value={qrValue} className={styles.qrSvg} />
                <div className={styles.qrFooter}>
                  <span className={styles.qrLabel}>scan to open</span>
                  <button
                    type='button'
                    className={styles.qrDownload}
                    onClick={handleDownloadQr}
                    title='download QR as PNG'
                  >
                    <IconDownload />
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
                <IconWhatsApp />
              </a>
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(displayUrl)}`}
                target='_blank'
                rel='noopener noreferrer'
                className={styles.shareIcon}
                title='share via Telegram'
              >
                <IconTelegram />
              </a>
              <a
                href={`mailto:?subject=${encodeURIComponent('Private note')}&body=${encodeURIComponent(displayUrl)}`}
                className={styles.shareIcon}
                title='share via email'
              >
                <IconEmail />
              </a>
              {typeof navigator.share === 'function' && (
                <button
                  type='button'
                  className={styles.shareIcon}
                  onClick={() => {
                    navigator
                      .share({ title: 'notefade', url: displayUrl })
                      .catch(() => {});
                  }}
                  title='share link'
                >
                  <IconShare />
                </button>
              )}
            </div>

            {fragment.startsWith(`#${PROTECTED_PREFIX}`) &&
              password.length > 0 && (
                <div className={styles.passwordDisplay}>
                  <span className={styles.passwordLabel}>password</span>
                  <span className={styles.passwordText}>
                    {showPw
                      ? password
                      : '\u2022'.repeat(
                          Math.min(password.length, PASSWORD_MASK_MAX),
                        )}
                  </span>
                  <button
                    type='button'
                    className={styles.passwordAction}
                    onClick={() => {
                      if (pwCopied !== 'idle') return;
                      navigator.clipboard.writeText(password);
                      setShowPw(false);
                      setPwCopied('shown');
                      setTimeout(
                        () => setPwCopied('fading'),
                        COPY_FLASH_FADE_MS,
                      );
                      setTimeout(() => setPwCopied('idle'), COPY_FLASH_DONE_MS);
                    }}
                    title={pwCopied !== 'idle' ? 'copied' : 'copy password'}
                  >
                    {pwCopied !== 'idle' ? (
                      <IconCheck size={14} />
                    ) : (
                      <IconClipboard size={14} />
                    )}
                  </button>
                  <button
                    type='button'
                    className={styles.passwordAction}
                    onClick={() => setShowPw((prev) => !prev)}
                    title={showPw ? 'hide password' : 'reveal password'}
                  >
                    {showPw ? <IconEye /> : <IconEyeOff />}
                  </button>
                </div>
              )}
          </div>

          {/* Steganographic sharing (Feature 7) */}
          <p className={styles.stegoLabel}>
            disguise your link with steganography
          </p>
          <div className={styles.stegoColumns}>
            <div className={styles.stegoColumn}>
              <div className={styles.stegoSection}>
                <p className={styles.stegoColumnLabel}>hide in text</p>
                <p className={styles.stegoDescription}>
                  your link will be hidden in zero-width characters, it will
                  look short but is long, some apps strip zero-width characters
                  when pasting — if the recipient can't decode it, send the link
                  directly instead
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
                      if (stegoText.length < MIN_STEGO_TEXT_LENGTH) return;
                      try {
                        const result = encodeZeroWidth(displayUrl, stegoText);
                        setStegoResult(result);
                      } catch {
                        setStegoResult(null);
                      }
                    }}
                    disabled={stegoText.length < MIN_STEGO_TEXT_LENGTH}
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
                      setTimeout(() => setStegoCopied(false), COPY_FEEDBACK_MS);
                    }}
                  >
                    <span>
                      {stegoResult.replace(/[\u200B\u200C\u200D]/g, '')}
                    </span>
                    <span className={styles.stegoHint}>
                      {stegoCopied
                        ? 'copied'
                        : 'click to copy — link is hidden in zero-width chars'}
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
                  messengers like WhatsApp compress images and destroy hidden
                  data — send as a ZIP file, or use your messenger's "send as
                  document" / "original quality" mode to preserve the PNG intact
                </p>
                <div className={styles.stegoImageBtnRow}>
                  <button
                    type='button'
                    className={styles.stegoImageBtn}
                    onClick={handleGenerateStegoImage}
                    disabled={stegoImageLoading}
                  >
                    <IconImage />
                    {stegoImageLoading ? 'generating...' : 'generate image'}
                  </button>
                  <button
                    type='button'
                    className={styles.stegoImageBtn}
                    onClick={() => stegoFileRef.current?.click()}
                    disabled={stegoImageLoading}
                  >
                    <IconUpload />
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
                        <IconDownload />
                        download PNG
                      </button>
                      <button
                        type='button'
                        className={styles.stegoDownloadBtn}
                        onClick={handleDownloadStegoZip}
                      >
                        <IconDownload />
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
                  const blob = new Blob(
                    [JSON.stringify(receiptVerification, null, 2)],
                    { type: 'application/json' },
                  );
                  const u = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = u;
                  a.download = 'notefade-receipt-verification.json';
                  a.click();
                  URL.revokeObjectURL(u);
                  setReceiptDownloaded(true);
                  setVerificationCopied(true);
                  setTimeout(
                    () => setVerificationCopied(false),
                    COPY_FEEDBACK_MS,
                  );
                }}
              >
                {verificationCopied
                  ? 'downloaded'
                  : 'download receipt verification file'}
              </button>
              <span className={styles.receiptHint}>
                keep this file to verify proof of read later
              </span>
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
                    navigator.clipboard.writeText(dUrl);
                    setCopiedDecoyIndex(i);
                    setTimeout(
                      () => setCopiedDecoyIndex(null),
                      COPY_FEEDBACK_MS,
                    );
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
                      localStorage.setItem(STORAGE_KEYS.BASE_URL, defaultBase);
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
                    <IconReset />
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
          {!hasCopied &&
            "you haven't copied the link yet — it can't be recovered"}
          {!hasCopied && needsReceipt && <br />}
          {needsReceipt &&
            "you haven't downloaded the receipt — you won't be able to verify proof of read without it"}
        </div>
      )}

      <a
        href={pathname}
        className={
          confirmingLeave ? styles.anotherLinkDanger : styles.anotherLink
        }
        onClick={(e) => {
          e.preventDefault();
          if (
            destroyState !== 'destroyed' &&
            !confirmingLeave &&
            (!hasCopied || needsReceipt)
          ) {
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
