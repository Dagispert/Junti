import { useState } from 'react';

/**
 * La foto vista a través de la lupa: ampliada («zoom» veces) y centrada en el
 * punto elegido (cx, cy de 0 a 1), sin dejar huecos en los bordes. Al cambiar
 * el zoom, se aleja (o se acerca) suavemente.
 */
export function Lupa({
  src,
  cx,
  cy,
  zoom,
  size,
  redonda,
  style,
}: {
  src?: string;
  cx: number;
  cy: number;
  zoom: number;
  size: number;
  redonda?: boolean;
  style?: React.CSSProperties;
}) {
  const [dim, setDim] = useState<{ w: number; h: number } | null>(null);
  let img: React.CSSProperties = { opacity: 0 };
  if (dim) {
    // a zoom 1, la foto llena el cuadro (como «cover»)
    const s = Math.max(size / dim.w, size / dim.h) * zoom;
    const w = dim.w * s;
    const h = dim.h * s;
    const left = Math.min(0, Math.max(size - w, size / 2 - cx * w));
    const top = Math.min(0, Math.max(size - h, size / 2 - cy * h));
    img = { width: w, height: h, left, top, opacity: 1 };
  }
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        overflow: 'hidden',
        borderRadius: redonda ? '50%' : 18,
        background: '#2A2420',
        ...style,
      }}>
      {!!src && (
        <img
          src={src}
          alt=""
          draggable={false}
          onLoad={(e) =>
            setDim({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
          }
          style={{
            position: 'absolute',
            maxWidth: 'none',
            userSelect: 'none',
            transition:
              'width .9s cubic-bezier(.2,.8,.2,1), height .9s cubic-bezier(.2,.8,.2,1), left .9s cubic-bezier(.2,.8,.2,1), top .9s cubic-bezier(.2,.8,.2,1), opacity .4s',
            ...img,
          }}
        />
      )}
    </div>
  );
}
