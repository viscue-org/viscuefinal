export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function normalizeUrl(value) {
  if (!value) return '';
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function isValidUrl(value) {
  if (!value || typeof value !== 'string') return false;
  const normalized = normalizeUrl(value);
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function safeHost(value) {
  try {
    return new URL(normalizeUrl(value)).hostname || value;
  } catch {
    return value;
  }
}

export async function createWebpagePreview(url) {
  const host = safeHost(url);
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  
  // Background
  const gradient = ctx.createLinearGradient(0, 0, 640, 400);
  gradient.addColorStop(0, '#1E232A');
  gradient.addColorStop(1, '#111418');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 640, 400);
  
  // Browser chrome mockup
  ctx.fillStyle = '#2B313A';
  ctx.fillRect(0, 0, 640, 44);
  
  // Window dots
  ctx.fillStyle = '#FF5F56'; ctx.beginPath(); ctx.arc(20, 22, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FFBD2E'; ctx.beginPath(); ctx.arc(38, 22, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#27C93F'; ctx.beginPath(); ctx.arc(56, 22, 6, 0, Math.PI * 2); ctx.fill();
  
  // URL bar
  ctx.fillStyle = '#1A1E24';
  ctx.roundRect(80, 10, 480, 24, 6);
  ctx.fill();
  
  ctx.fillStyle = '#9AA0A6';
  ctx.font = '12px system-ui, -apple-system, sans-serif';
  ctx.fillText(url.length > 55 ? url.slice(0, 52) + '…' : url, 96, 26);
  
  // Live visual mockup
  ctx.fillStyle = '#D9532F';
  ctx.font = 'bold 28px "Instrument Sans", system-ui, -apple-system, sans-serif';
  ctx.fillText(host.toUpperCase(), 48, 140);
  
  ctx.fillStyle = '#E6E2DE';
  ctx.font = '16px system-ui, -apple-system, sans-serif';
  ctx.fillText('Live Web Context Reference', 48, 175);
  
  ctx.strokeStyle = '#3A3F46';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(48, 200);
  ctx.lineTo(592, 200);
  ctx.stroke();
  
  // Mock content blocks
  ctx.fillStyle = '#2A303A';
  ctx.roundRect(48, 220, 260, 120, 8);
  ctx.fill();
  ctx.roundRect(332, 220, 260, 120, 8);
  ctx.fill();
  
  return canvas.toDataURL('image/png');
}

export async function parseDocxContent(dataUrl) {
  try {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    
    // Extract XML from docx archive if present
    const decoder = new TextDecoder('utf-8');
    const fullText = decoder.decode(bytes);
    
    // Parse text fragments from document.xml or text representation
    const textMatches = [...fullText.matchAll(/<w:t[^>]*>([^<]+)<\/w:t>/g)].map(m => m[1]);
    const extractedText = textMatches.join(' ').trim() || fullText.slice(0, 2000).replace(/[^\x20-\x7E\n\r\t]/g, ' ');
    
    // Split into sections/pages
    const paragraphs = extractedText.split(/\n\s*\n|\.\s{2,}/).filter(p => p.trim().length > 0);
    const pageSize = 5; // ~5 paragraphs per canonical page
    const totalPages = Math.max(1, Math.ceil(paragraphs.length / pageSize));
    
    const pages = [];
    for (let p = 0; p < totalPages; p++) {
      const pageParagraphs = paragraphs.slice(p * pageSize, (p + 1) * pageSize);
      pages.push({
        pageNumber: p + 1,
        pageId: `page_${String(p + 1).padStart(2, '0')}`,
        paragraphs: pageParagraphs,
        heading: pageParagraphs[0]?.slice(0, 60) || `Section ${p + 1}`,
      });
    }
    
    return {
      success: true,
      totalPages,
      pages,
      sections: pages.map(page => ({
        id: page.pageId,
        title: page.heading,
        content: page.paragraphs.join('\n\n'),
      })),
    };
  } catch (err) {
    return {
      success: false,
      totalPages: 1,
      pages: [{ pageNumber: 1, pageId: 'page_01', paragraphs: ['Document preview unavailable'], heading: 'Document' }],
      sections: [{ id: 'page_01', title: 'Document', content: 'Document content' }],
      error: err.message,
    };
  }
}

export function renderDocxPageToCanvas(page, docName = 'Document') {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 1100;
  const ctx = canvas.getContext('2d');
  
  // Clean white paper
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, 800, 1100);
  
  // Header
  ctx.fillStyle = '#6F6B66';
  ctx.font = '12px system-ui, -apple-system, sans-serif';
  ctx.fillText(docName, 60, 50);
  ctx.fillText(`Page ${page.pageNumber}`, 700, 50);
  
  ctx.strokeStyle = '#E6E2DE';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 65);
  ctx.lineTo(740, 65);
  ctx.stroke();
  
  // Heading
  ctx.fillStyle = '#161616';
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.fillText(page.heading || `Page ${page.pageNumber}`, 60, 110);
  
  // Body text
  ctx.fillStyle = '#2B2B2B';
  ctx.font = '14px/22px system-ui, -apple-system, sans-serif';
  let y = 150;
  
  for (const para of page.paragraphs || []) {
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const testLine = line + word + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > 680 && line !== '') {
        ctx.fillText(line, 60, y);
        line = word + ' ';
        y += 24;
        if (y > 1020) break;
      } else {
        line = testLine;
      }
    }
    if (line && y <= 1020) {
      ctx.fillText(line, 60, y);
      y += 36;
    }
    if (y > 1020) break;
  }
  
  // Page footer
  ctx.fillStyle = '#9AA0A6';
  ctx.font = '11px system-ui, -apple-system, sans-serif';
  ctx.fillText('VisCue Canonical Render v1.0', 60, 1060);
  
  return canvas.toDataURL('image/png');
}

export function renderCropDataUrl(dataUrl, crop) {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      const scale = Math.max(1, crop.scale || 1);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      const x = (image.naturalWidth - width) * ((crop.x ?? 50) / 100);
      const y = (image.naturalHeight - height) * ((crop.y ?? 50) / 100);
      context.drawImage(image, x, y, width, height);
      resolve(canvas.toDataURL('image/png', 0.96));
    };
    image.onerror = reject;
    image.src = dataUrl;
  });
}

export function downscaleDataUrl(dataUrl, maxSize = 1200, quality = 0.90) {
  return new Promise((resolve, reject) => {
    if (!dataUrl) return resolve(null);
    const image = new window.Image();
    image.onload = () => {
      let { naturalWidth: w, naturalHeight: h } = image;
      if (w <= maxSize && h <= maxSize) return resolve(dataUrl);
      if (w > h) { h = Math.round(h * (maxSize / w)); w = maxSize; }
      else { w = Math.round(w * (maxSize / h)); h = maxSize; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    image.onerror = reject;
    image.src = dataUrl;
  });
}

export async function captureVideoFrame(video) {
  if (!video?.videoWidth || !video?.videoHeight) {
    throw new Error('The video is not ready. Wait for it to load, then try again.');
  }
  video.pause();
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/png');
  return {
    dataUrl,
    timeMs: Math.round(video.currentTime * 1000),
    frameIndex: null,
    parentResolution: [video.videoWidth, video.videoHeight],
    contentHash: await digest(dataUrl),
  };
}

export async function digest(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return `sha256:${[...new Uint8Array(hash)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')}`;
}

export function formatTime(seconds = 0) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safe / 60);
  const whole = Math.floor(safe % 60);
  const ms = Math.floor((safe % 1) * 1000);
  return `${String(minutes).padStart(2, '0')}:${String(whole).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

export async function cropImageDataUrl(dataUrl, rect) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scaleX = img.naturalWidth / (rect.innerWidth || window.innerWidth || 1);
      const scaleY = img.naturalHeight / (rect.innerHeight || window.innerHeight || 1);
      
      const cropX = Math.max(0, Math.round(rect.x * scaleX));
      const cropY = Math.max(0, Math.round(rect.y * scaleY));
      const cropWidth = Math.max(1, Math.min(img.naturalWidth - cropX, Math.round(rect.width * scaleX)));
      const cropHeight = Math.max(1, Math.min(img.naturalHeight - cropY, Math.round(rect.height * scaleY)));
      
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
