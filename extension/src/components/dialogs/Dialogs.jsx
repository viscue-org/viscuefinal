import React, { useState, useRef } from 'react';
import { X, Timer, FilmStrip, ArrowElbowRightDown, SpinnerGap, PaperPlaneTilt, FileText, ArrowLeft, ArrowRight, ListDashes } from '@phosphor-icons/react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { normalizeUrl, captureVideoFrame, formatTime, parseDocxContent, renderDocxPageToCanvas } from '../../utils/helpers';
import { stageLabel } from '../../utils/vicsuc';

export function Modal({ children, close, wide = false, className = '' }) {
  return (
    <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}>
      <section className={`modal ${wide ? 'wide' : ''} ${className}`.trim()} role="dialog" aria-modal="true">
        {children}
      </section>
    </div>
  );
}

export function WebDialog({ close, submit }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const normalized = normalizeUrl(trimmed);
    try {
      new URL(normalized);
      setError('');
      submit(normalized);
    } catch {
      setError('Please enter a valid website address (e.g. https://viscue.space)');
    }
  };

  return (
    <Modal close={close}>
      <header>
        <div><small>Asset</small><h2>Add a webpage</h2></div>
        <button onClick={close} aria-label="Close dialog"><X size={18} /></button>
      </header>
      <label className="field">
        Web address
        <input 
          value={url} 
          onChange={e => { setUrl(e.target.value); setError(''); }} 
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
          placeholder="https://viscue.space" 
          autoFocus 
        />
      </label>
      {error && <p className="field-error" style={{ color: 'var(--color-error, #D92D20)', fontSize: '13px', margin: '4px 0 0' }}>{error}</p>}
      <footer>
        <button className="secondary" onClick={close}>Cancel</button>
        <button className="primary" onClick={handleSubmit} disabled={!url.trim()}>Add webpage</button>
      </footer>
    </Modal>
  );
}

export function CropDialog({ node, close, save }) {
  const [crop, setCrop] = useState();
  const imageRef = useRef(null);

  const handleApply = () => {
    if (!crop || !crop.width || !crop.height || !imageRef.current) return save(null);
    const canvas = document.createElement('canvas');
    const image = imageRef.current;
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width * scaleX;
    canvas.height = crop.height * scaleY;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width * scaleX,
      crop.height * scaleY
    );
    save(canvas.toDataURL('image/png', 1.0));
  };

  return (
    <Modal close={close} wide className="crop-modal">
      <header>
        <div><small style={{ color: 'var(--text-muted)' }}>Asset</small><h2>Crop image</h2></div>
        <button onClick={close} aria-label="Close dialog"><X size={18} /></button>
      </header>
      <div className="crop-workspace" style={{ background: 'var(--bg-subtle, #f7f9fa)', padding: 20, textAlign: 'center', overflow: 'auto', maxHeight: '60vh', display: 'flex', justifyContent: 'center', borderRadius: '24px', border: '1px solid var(--border-default)', margin: '16px 0' }}>
        <ReactCrop crop={crop} onChange={c => setCrop(c)}>
          <img 
            ref={imageRef} 
            src={node?.data.originalDataUrl || node?.data.dataUrl} 
            alt="Crop" 
            style={{ maxHeight: '55vh', maxWidth: '100%', display: 'block', borderRadius: 'var(--radius-md)' }} 
            crossOrigin="anonymous" 
          />
        </ReactCrop>
      </div>
      <footer>
        <button className="secondary" onClick={() => setCrop(undefined)}>Reset</button>
        <button className="secondary" onClick={close}>Cancel</button>
        <button className="primary" onClick={handleApply}>Apply crop</button>
      </footer>
    </Modal>
  );
}

export function VideoDialog({ node, close, extract, save }) {
  const videoRef = useRef(null);
  const initialRange = node?.data.temporalRange;
  const [durationMs, setDurationMs] = useState(node?.data.video?.durationMs || 0);
  const [currentMs, setCurrentMs] = useState(initialRange?.startMs || 0);
  const [range, setRange] = useState(initialRange || { startMs: 0, endMs: node?.data.video?.durationMs || 0 });
  const [extracting, setExtracting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const loadMetadata = event => {
    const duration = Math.round((event.currentTarget.duration || 0) * 1000);
    setDurationMs(duration);
    setRange(value => ({
      startMs: Math.min(value.startMs || 0, duration),
      endMs: value.endMs > 0 ? Math.min(value.endMs, duration) : duration
    }));
    if (currentMs > 0) event.currentTarget.currentTime = Math.min(currentMs / 1000, event.currentTarget.duration || 0);
  };

  const seek = value => {
    const next = Number(value);
    setCurrentMs(next);
    if (videoRef.current) videoRef.current.currentTime = next / 1000;
  };

  const handleExtract = async () => {
    if (!videoRef.current) return;
    setExtracting(true);
    try {
      await extract(videoRef.current);
    } finally {
      setExtracting(false);
    }
  };

  const adjustStart = (deltaMs) => {
    setRange(r => {
      const nextStart = Math.max(0, Math.min(r.startMs + deltaMs, r.endMs - 500));
      seek(nextStart);
      return { ...r, startMs: nextStart };
    });
  };

  const adjustEnd = (deltaMs) => {
    setRange(r => {
      const nextEnd = Math.max(r.startMs + 500, Math.min(r.endMs + deltaMs, durationMs));
      seek(nextEnd);
      return { ...r, endMs: nextEnd };
    });
  };

  const valid = durationMs > 0 && range.endMs > range.startMs;
  const trimmedDurationSec = Math.max(0, (range.endMs - range.startMs) / 1000);

  return (
    <Modal close={close} wide className="video-modal">
      <header>
        <div>
          <small style={{ color: 'var(--text-muted)' }}>Video Trim & Extract</small>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>{node?.data?.name || 'Video Editor'}</h2>
        </div>
        <button onClick={close} aria-label="Close dialog"><X size={18} /></button>
      </header>
      
      <div className="video-editor-preview" style={{ background: 'var(--bg-subtle, #f7f9fa)', padding: 20, textAlign: 'center', overflow: 'auto', maxHeight: '45vh', display: 'flex', justifyContent: 'center', borderRadius: '24px', border: '1px solid var(--border-default)', margin: '16px 0' }}>
        <video 
          ref={videoRef} 
          src={node?.data.dataUrl} 
          controls 
          onLoadedMetadata={loadMetadata} 
          onTimeUpdate={event => setCurrentMs(Math.round(event.currentTarget.currentTime * 1000))} 
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          style={{ maxWidth: '100%', maxHeight: '45vh', display: 'block' }}
        />
      </div>

      {/* Standard Video Trim Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: 'var(--bg-subtle)', borderRadius: '16px', border: '1px solid var(--border-default)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Trim Timeline Range</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            Playhead: <strong style={{ color: 'var(--text-primary)' }}>{formatTime(currentMs / 1000)}</strong> / {formatTime(durationMs / 1000)}
          </span>
        </div>

        {/* Visual Timeline with Trimmed Active Zone */}
        <div className="dual-slider-container" style={{ background: 'var(--surface)', borderRadius: '12px', overflow: 'hidden' }}>
          {durationMs > 0 && (
            <div 
              style={{
                position: 'absolute',
                left: `${(range.startMs / durationMs) * 100}%`,
                width: `${((range.endMs - range.startMs) / durationMs) * 100}%`,
                top: 0,
                bottom: 0,
                background: 'var(--purple-soft)',
                pointerEvents: 'none'
              }}
            />
          )}
          {/* Playhead Slider */}
          <input 
            aria-label="Video timeline scrubber" 
            type="range" 
            min="0" 
            max={durationMs || 1} 
            step="10" 
            value={Math.min(currentMs, durationMs || 1)} 
            onChange={event => seek(event.target.value)} 
            style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: 0, width: '100%', margin: 0, cursor: 'pointer', zIndex: 2, accentColor: 'var(--text-secondary)', opacity: 0.85 }}
          />
          {/* Start Slider */}
          <input 
            className="dual-slider"
            type="range"
            min="0"
            max={durationMs || 1}
            step="10"
            value={range.startMs}
            onChange={event => setRange(r => ({ ...r, startMs: Math.min(Number(event.target.value), r.endMs) }))}
          />
          {/* End Slider */}
          <input 
            className="dual-slider"
            type="range"
            min="0"
            max={durationMs || 1}
            step="10"
            value={range.endMs}
            onChange={event => setRange(r => ({ ...r, endMs: Math.max(Number(event.target.value), r.startMs) }))}
          />
        </div>

        {/* Start / End Times */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px', marginTop: '-4px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Start</span>
            <strong style={{ fontSize: '13px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{formatTime(range.startMs / 1000)}</strong>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>End</span>
            <strong style={{ fontSize: '13px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{formatTime(range.endMs / 1000)}</strong>
          </div>
        </div>

        {/* Selected Duration summary */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
          <span>Trimmed Segment Length: <strong style={{ color: 'var(--viscue-signal, #5B7593)' }}>{trimmedDurationSec.toFixed(2)}s</strong></span>
          <button type="button" className="secondary" style={{ border: 0, padding: 0, textDecoration: 'underline', fontSize: '12px', cursor: 'pointer', background: 'transparent' }} onClick={() => setRange({ startMs: 0, endMs: durationMs })}>
            Reset to Full Video ({formatTime(durationMs / 1000)})
          </button>
        </div>
      </div>

      <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <button 
          type="button" 
          className="secondary" 
          onClick={handleExtract} 
          disabled={extracting}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <FilmStrip size={17} /> {extracting ? 'Extracting…' : `Extract Frame at ${formatTime(currentMs / 1000)}`}
        </button>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="secondary" onClick={close}>Cancel</button>
          <button className="primary" onClick={() => save(range)} disabled={!valid}>Save Trimmed Range</button>
        </div>
      </footer>
    </Modal>
  );
}

export function NewCanvasDialog({ close, saveAndDiscard, clearWithoutSaving }) {
  return (
    <Modal close={close}>
      <header><div><small>Workspace</small><h2>Start a new canvas?</h2></div><button onClick={close} aria-label="Close dialog"><X size={18} /></button></header>
      <p className="modal-copy">Choose how you want to clear the active canvas.</p>
      <footer><button className="secondary" onClick={clearWithoutSaving}>Clear without saving</button><button className="danger-button" onClick={saveAndDiscard}>Save and discard</button></footer>
    </Modal>
  );
}

export function HostClosedDialog({ saveAndClose, discardAndClose }) {
  return (
    <Modal close={discardAndClose}>
      <header><div><small>Connection Lost</small><h2>Source tab closed</h2></div></header>
      <p className="modal-copy">The platform tab that opened this workspace has been closed. Would you like to save this canvas to history before closing the workspace?</p>
      <footer><button className="secondary" onClick={discardAndClose}>Discard and close</button><button className="primary" onClick={saveAndClose}>Save and close</button></footer>
    </Modal>
  );
}

export function HistoryDialog({ close, history, config, setConfig, clearAll, restore }) {
  const [confirmClear, setConfirmClear] = useState(false);
  return (
    <Modal close={close}>
      <header><div><small>Workspace</small><h2>History</h2></div><button onClick={close} aria-label="Close dialog"><X size={18} /></button></header>
      
      <div className="history-settings">
        <strong>Auto-delete history older than:</strong>
        <select value={config.autoDeleteHours} onChange={e => setConfig(Number(e.target.value))}>
          <option value={24}>24 hours</option>
          <option value={48}>48 hours</option>
          <option value={168}>7 days</option>
        </select>
      </div>

      <div className="history-list">
        {history.length === 0 && <p className="modal-copy">No history snapshots found.</p>}
        {history.map(item => (
          <div key={item.id} className="history-item">
            <div>
              <strong>{new Date(item.timestamp).toLocaleString()}</strong>
              <span>{item.nodes.filter(n => n.type === 'asset').length} assets</span>
            </div>
            <button className="primary" onClick={() => { restore(item.nodes, item.edges); close(); }}>Restore</button>
          </div>
        ))}
      </div>

      {history.length > 0 && (
        <footer style={{ justifyContent: 'flex-start', marginTop: 20 }}>
          {confirmClear ? (
            <>
              <button className="secondary" onClick={() => setConfirmClear(false)}>Cancel</button>
              <button className="danger-button" onClick={() => { clearAll(); setConfirmClear(false); }}>Yes, delete all</button>
            </>
          ) : (
            <button className="secondary" onClick={() => setConfirmClear(true)}>Clear all history</button>
          )}
        </footer>
      )}
    </Modal>
  );
}

export function ConfirmDialog({ title, body, confirm, close, action }) { 
  return (
    <Modal close={close}>
      <header><div><small>Confirm</small><h2>{title}</h2></div><button onClick={close} aria-label="Close dialog"><X size={18} /></button></header>
      <p className="modal-copy">{body}</p>
      <footer><button className="secondary" onClick={close}>Cancel</button><button className="danger-button" onClick={action}>{confirm}</button></footer>
    </Modal>
  );
}

export function SendDialog({ graph, plan = 'free', review, busy, submit, setSubmit, close, action }) { 
  const assets = graph.items.filter(item => item.kind !== 'note').length; 
  const annotations = graph.cues.length; 
  const motions = graph.motions.length; 
  const limits = { free: 2, pro: 10, plus: 20 };
  const selected = review?.selected_references?.length;
  const trimmed = review?.trimmed_references || [];
  return (
    <Modal close={close} wide>
      <header><div><small>Final review</small><h2>Send visual intent</h2></div><button onClick={close} disabled={busy} aria-label="Close dialog"><X size={18} /></button></header>
      <div className="review-grid">
        <div><strong>{assets}</strong><span>Assets</span></div>
        <div><strong>{annotations}</strong><span>Annotations</span></div>
        <div><strong>{motions}</strong><span>Motions</span></div>
        <div><strong>{graph.items.filter(item => item.kind === 'note' && item.intentional).length}</strong><span>Text notes</span></div>
      </div>
      <div className="vicsuc-plan-summary">
        <strong>{plan[0].toUpperCase() + plan.slice(1)} plan</strong>
        <span>{review ? `${selected} selected of ${limits[plan]} allowed` : `Up to ${limits[plan]} physical references`}</span>
      </div>
      {review && <div className="vicsuc-stage-review" aria-label="VICSUC execution stages">
        {review.stages?.map(stage => <div key={stage.name} className={`stage-${stage.status}`}><span>{stage.name.replaceAll('.', ' ')}</span><strong>{stageLabel(stage)}</strong></div>)}
        {trimmed.length > 0 && <p><strong>{trimmed.length} optional reference{trimmed.length === 1 ? '' : 's'} trimmed:</strong> {trimmed.map(item => item.name).join(', ')}</p>}
      </div>}
      <div className="sequence">
        <div><span>1</span><p><strong>Attach references</strong><small>Wait for every upload to finish</small></p></div>
        <ArrowElbowRightDown size={18} />
        <div><span>2</span><p><strong>Insert intent</strong><small>Only after references are ready</small></p></div>
        <ArrowElbowRightDown size={18} />
        <div><span>3</span><p><strong>{submit ? 'Submit to AI' : 'Leave for review'}</strong><small>You control final submission</small></p></div>
      </div>
      <label className="submit-toggle">
        <input type="checkbox" checked={submit} onChange={e => setSubmit(e.target.checked)} />
        <span><strong>Submit automatically</strong><small>Turn off to review the final prompt in chat first.</small></span>
      </label>
      <footer>
        <button className="secondary" onClick={close} disabled={busy}>Cancel</button>
        <button className="primary send" onClick={action} disabled={busy}>
          {busy ? <><SpinnerGap className="spin" size={18} /> Preparing…</> : <><PaperPlaneTilt size={18} weight="fill" /> {review ? (submit ? 'Attach, then submit' : 'Attach and insert') : 'Prepare VICSUC review'}</>}
        </button>
      </footer>
    </Modal>
  ); 
}

export function DocumentDialog({ node, close, extractPage, extractSection }) {
  const canvasRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [docxData, setDocxData] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isDocx = (node?.data?.name || '').toLowerCase().endsWith('.docx') || (node?.data?.mime || '').includes('word');

  React.useEffect(() => {
    if (!node?.data?.dataUrl) return;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        if (isDocx) {
          const parsed = await parseDocxContent(node.data.dataUrl);
          setDocxData(parsed);
          setTotalPages(parsed.totalPages);
          setPage(1);
        } else {
          // PDF renderer
          const pdfjsLib = await import('pdfjs-dist');
          pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
            'pdfjs-dist/build/pdf.worker.mjs', import.meta.url
          ).href;
          const data = atob(node.data.dataUrl.split(',')[1]);
          const arr = new Uint8Array(data.length);
          for (let i = 0; i < data.length; i++) arr[i] = data.charCodeAt(i);
          const loaded = await pdfjsLib.getDocument({ data: arr }).promise;
          setPdf(loaded);
          setTotalPages(loaded.numPages);
          setPage(1);
        }
      } catch (e) {
        setError('Could not load document: ' + e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [node?.data?.dataUrl, isDocx]);

  React.useEffect(() => {
    if (loading || !canvasRef.current) return;
    
    (async () => {
      try {
        if (isDocx && docxData?.pages) {
          const currentPageData = docxData.pages[page - 1] || docxData.pages[0];
          const renderedDataUrl = renderDocxPageToCanvas(currentPageData, node?.data?.name);
          const img = new Image();
          img.onload = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
          };
          img.src = renderedDataUrl;
        } else if (pdf) {
          const pdfPage = await pdf.getPage(page);
          const viewport = pdfPage.getViewport({ scale: 1.6 });
          const canvas = canvasRef.current;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        }
      } catch (e) {
        setError('Could not render page: ' + e.message);
      }
    })();
  }, [pdf, docxData, page, isDocx, loading, node?.data?.name]);

  function handleExtractPage() {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const provenanceMeta = isDocx ? {
      documentType: 'docx',
      canonicalRenderVersion: 'v1',
      sourceSection: docxData?.pages?.[page - 1]?.heading || `Section ${page}`,
    } : {
      documentType: 'pdf',
      pageNumber: page,
    };
    extractPage?.(dataUrl, page, provenanceMeta);
    close();
  }

  function handleExtractSection() {
    const currentSection = docxData?.sections?.[page - 1] || {
      title: `${node?.data?.name || 'Document'} — Section ${page}`,
      content: `Page ${page} content`,
    };
    extractSection?.(currentSection.title, currentSection.content);
    close();
  }

  const docTitle = node?.data?.name || (isDocx ? 'Word Document' : 'PDF Document');

  return (
    <Modal close={close} wide className="document-modal">
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--viscue-hairline, #E5E2DD)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileText size={22} color="var(--viscue-signal, #5B7593)" />
          <div>
            <small style={{ display: 'block', fontSize: '11px', color: 'var(--muted, #7A7670)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {isDocx ? 'DOCX Document (Canonical Render)' : 'PDF Document'}
            </small>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{docTitle}</h2>
          </div>
        </div>
        <button onClick={close} aria-label="Close dialog" style={{ background: 'transparent', border: 0, cursor: 'pointer' }}><X size={20} /></button>
      </header>

      <div className="pdf-viewer" style={{ background: '#1B1A18', padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '360px', maxHeight: '56vh', overflow: 'auto' }}>
        {loading && <div className="pdf-status" style={{ color: '#FFF', display: 'flex', alignItems: 'center', gap: '8px' }}><SpinnerGap className="spin" size={24} /> Loading document…</div>}
        {error && <div className="pdf-status error" style={{ color: 'var(--color-error, #D92D20)' }}>{error}</div>}
        {!loading && !error && (
          <canvas 
            ref={canvasRef} 
            className="pdf-canvas" 
            style={{ 
              maxWidth: '100%', 
              maxHeight: '52vh', 
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)', 
              borderRadius: '4px',
              backgroundColor: '#FFFFFF' 
            }} 
          />
        )}
      </div>

      {totalPages > 0 && (
        <div className="pdf-controls" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', padding: '12px', background: 'var(--viscue-control-soft, #F1EDEA)' }}>
          <button 
            type="button"
            className="secondary" 
            onClick={() => setPage(p => Math.max(1, p - 1))} 
            disabled={page <= 1}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 14px', borderRadius: '8px' }}
          >
            <ArrowLeft size={14} /> Prev
          </button>
          <span style={{ fontSize: '14px', fontWeight: 500 }}>Page {page} of {totalPages}</span>
          <button 
            type="button"
            className="secondary" 
            onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
            disabled={page >= totalPages}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 14px', borderRadius: '8px' }}
          >
            Next <ArrowRight size={14} />
          </button>
        </div>
      )}

      <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid var(--viscue-hairline, #E6E2DE)' }}>
        {isDocx && (
          <button 
            type="button" 
            className="secondary" 
            onClick={handleExtractSection} 
            disabled={loading || !!error}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginRight: 'auto' }}
          >
            <ListDashes size={16} /> Extract Section as Note
          </button>
        )}
        <button className="secondary" onClick={close}>Cancel</button>
        <button className="primary" onClick={handleExtractPage} disabled={loading || !!error}>
          Extract Page {page} to Canvas
        </button>
      </footer>
    </Modal>
  );
}
