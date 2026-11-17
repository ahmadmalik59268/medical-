import React, { useMemo } from 'react';
import { encodeCode128Bars } from '../utils/barcode';

interface BarcodeSvgProps {
  value: string;
  height?: number;
  showValue?: boolean;
  className?: string;
}

export const BarcodeSvg: React.FC<BarcodeSvgProps> = ({
  value,
  height = 38,
  showValue = true,
  className = '',
}) => {
  const { bars, totalWidth } = useMemo(() => encodeCode128Bars(value), [value]);

  return (
    <div className={`inline-flex flex-col items-center bg-white px-2 py-1 rounded ${className}`}>
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        className="w-full max-w-[200px]"
        style={{ height: `${height}px` }}
        role="img"
        aria-label={`Barcode ${value}`}
        preserveAspectRatio="none"
      >
        <rect x="0" y="0" width={totalWidth} height={height} fill="#ffffff" />
        {bars.map((bar, idx) => (
          <rect
            key={idx}
            x={bar.x}
            y={0}
            width={bar.width}
            height={height}
            fill="#0f172a"
          />
        ))}
      </svg>
      {showValue && (
        <span className="mt-0.5 font-mono-num text-[10px] tracking-[0.18em] text-slate-900 select-all">
          {value}
        </span>
      )}
    </div>
  );
};
