import { useState, useEffect } from 'react';

type VisualViewportState = {
  height: number;
  offsetTop: number;
  offsetBottom: number;
};

export function useVisualViewport(): VisualViewportState {
  const [state, setState] = useState<VisualViewportState>({
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
    offsetTop: 0,
    offsetBottom: 0
  });

  useEffect(() => {
    const update = (): void => {
      const vv = window.visualViewport;
      if (!vv) return;
      const offsetTop = vv.offsetTop;
      const height = vv.height;
      const offsetBottom = Math.max(
        0,
        window.innerHeight - (offsetTop + height)
      );
      setState({ height, offsetTop, offsetBottom });
    };

    const vv = window.visualViewport;
    if (!vv) return;

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();

    return (): void => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return state;
}
