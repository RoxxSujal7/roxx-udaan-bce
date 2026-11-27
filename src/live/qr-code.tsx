"use client";

import * as React from "react";
import qrcode from "qrcode-generator";

/**
 * Renders a crisp inline SVG QR code without any external QR API calls.
 */
export function QrCodeSvg({
  value,
  size = 112,
  label = "QR code",
}: {
  value: string;
  size?: number;
  label?: string;
}) {
  const pathData = React.useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    const parts: string[] = [];
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          parts.push(`M${c},${r}h1v1h-1z`);
        }
      }
    }
    return { count, d: parts.join("") };
  }, [value]);

  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`-2 -2 ${pathData.count + 4} ${pathData.count + 4}`}
      className="shrink-0 rounded-xl bg-white p-1"
      shapeRendering="crispEdges"
    >
      <rect
        x={-2}
        y={-2}
        width={pathData.count + 4}
        height={pathData.count + 4}
        fill="#ffffff"
      />
      <path d={pathData.d} fill="#0a0a0a" />
    </svg>
  );
}
