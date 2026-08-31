import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import { PreloadOverlay } from './components/PreloadOverlay';

function loadDesignEditor() {
  return import('./components/DesignEditor').then((mod) => ({
    default: mod.DesignEditor,
  }));
}

const DesignEditorLazy = lazy(loadDesignEditor);

function PaintAfterCommit({ onPainted }: { onPainted: () => void }) {
  useLayoutEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(onPainted);
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [onPainted]);

  return null;
}

function ReadyEditor({ onPainted }: { onPainted: () => void }) {
  return (
    <>
      <DesignEditorLazy />
      <PaintAfterCommit onPainted={onPainted} />
    </>
  );
}

export default function App() {
  const [progress, setProgress] = useState(15);
  const [fontsReady, setFontsReady] = useState(false);
  const [moduleReady, setModuleReady] = useState(false);
  const [painted, setPainted] = useState(false);
  const [fading, setFading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    document.fonts.ready.then(() => {
      if (cancelled) return;
      setFontsReady(true);
      setProgress((p) => Math.max(p, 50));
    });

    loadDesignEditor()
      .then(() => {
        if (cancelled) return;
        setModuleReady(true);
        setProgress((p) => Math.max(p, 90));
      })
      .catch(() => {
        if (cancelled) return;
        setModuleReady(true);
        setPainted(true);
        setProgress(100);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handlePainted = useCallback(() => {
    setPainted(true);
  }, []);

  const bootComplete = fontsReady && moduleReady && painted;

  useEffect(() => {
    if (!bootComplete || dismissed) return;

    setProgress(100);
    setFading(true);

    const timeout = window.setTimeout(() => {
      document.getElementById('app-preload')?.remove();
      setDismissed(true);
    }, 200);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [bootComplete, dismissed]);

  return (
    <>
      <Suspense fallback={null}>
        <ReadyEditor onPainted={handlePainted} />
      </Suspense>
      {!dismissed && <PreloadOverlay value={progress} fading={fading} />}
    </>
  );
}
