import { useMemo, forwardRef } from 'react';
import qrcode from 'qrcode-generator';

interface QrCodeProps {
  value: string;
  className?: string;
}

export const QrCode = forwardRef<SVGSVGElement, QrCodeProps>(
  function QrCode({ value, className }, ref) {
    const modules = useMemo(() => {
      const qr = qrcode(0, 'M');
      qr.addData(value);
      qr.make();
      const count = qr.getModuleCount();
      const grid: boolean[][] = [];
      for (let r = 0; r < count; r++) {
        const row: boolean[] = [];
        for (let c = 0; c < count; c++) {
          row.push(qr.isDark(r, c));
        }
        grid.push(row);
      }
      return { grid, count };
    }, [value]);

    const margin = 4;
    const total = modules.count + margin * 2;
    const radius = 0.3;

    return (
      <svg
        ref={ref}
        viewBox={`0 0 ${total} ${total}`}
        className={className}
        role="img"
        aria-label="QR code"
      >
        <rect width={total} height={total} fill="#0d0d0d" rx="0.5" />
        {modules.grid.map((row, r) =>
          row.map(
            (dark, c) =>
              dark && (
                <rect
                  key={`${r}-${c}`}
                  x={c + margin}
                  y={r + margin}
                  width={1}
                  height={1}
                  rx={radius}
                  fill="#ffffff"
                />
              ),
          ),
        )}
      </svg>
    );
  },
);
