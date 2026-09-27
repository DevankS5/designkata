import { useEffect, useRef, useState } from 'react';

let renderCount = 0;
const dark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

/** Renders Mermaid text as a diagram, a moment after the learner stops typing. Mermaid loads only when needed. */
export function DiagramPreview({ source }: { source: string }) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    const handle = window.setTimeout(async () => {
      const ticket = ++latest.current;
      if (!source.trim()) {
        setSvg('');
        setError(null);
        return;
      }
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: dark() ? 'dark' : 'neutral',
          fontFamily: 'JetBrains Mono, monospace',
        });
        await mermaid.parse(source);
        const { svg: rendered } = await mermaid.render(`diagram-${++renderCount}`, source);
        if (ticket === latest.current) {
          setSvg(rendered);
          setError(null);
        }
      } catch (e) {
        if (ticket === latest.current) setError(e instanceof Error ? e.message.split('\n').slice(0, 3).join('\n') : String(e));
      }
    }, 350);
    return () => window.clearTimeout(handle);
  }, [source]);

  return (
    <div className="preview" aria-label="Diagram preview">
      {error && <p className="preview-error">{error}</p>}
      {/* Mermaid's strict security level sanitises labels before they reach this SVG. */}
      <div dangerouslySetInnerHTML={{ __html: svg }} />
      {!svg && !error && <p className="muted small">The diagram appears here as you type.</p>}
    </div>
  );
}
