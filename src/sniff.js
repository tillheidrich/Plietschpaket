/**
 * Magic-byte checks for uploads. Declared type (kind or file extension) must match the content, so that
 * e.g. a ".png" carrying ICNS/HEIF data never reaches the image-size parsers, and no script-like file
 * hides behind a media extension.
 */
import fs from 'node:fs';

// Magic-byte check: the declared kind must match the actual file content.
export function sniff(buf) {
  const hex = buf.subarray(0, 12).toString('hex');
  const ascii = buf.subarray(0, 12).toString('latin1');
  if (hex.startsWith('89504e47')) return 'image';
  if (hex.startsWith('ffd8ff')) return 'image';
  if (ascii.startsWith('GIF8')) return 'image';
  if (ascii.startsWith('BM')) return 'image';
  if (hex.startsWith('49492a00') || hex.startsWith('4d4d002a')) return 'image';
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'image';
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WAVE') return 'audio';
  if (ascii.slice(4, 8) === 'ftyp') return /^(M4A|M4B)/.test(ascii.slice(8, 12)) ? 'audio' : 'video';
  if (hex.startsWith('1a45dfa3')) return 'video';
  if (ascii.startsWith('OggS')) return 'audio';
  if (ascii.startsWith('ID3') || hex.startsWith('fffb') || hex.startsWith('fff3') || hex.startsWith('fff2')) return 'audio';
  if (ascii.startsWith('%PDF')) return 'file';
  if (hex.startsWith('504b0304')) return 'file';
  return 'text';
}
export function kindMatches(kind, buf) {
  const k = sniff(buf);
  if (kind === 'file') return k === 'file' || k === 'text';
  if (kind === 'audio') return k === 'audio' || k === 'video'; // ogg/mp4 containers carry audio too
  if (kind === 'video') return k === 'video' || (k === 'audio' && buf.subarray(0, 4).toString('latin1') === 'OggS');
  return k === kind;
}


const EXT_KIND = {
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', bmp: 'image', tif: 'image', tiff: 'image',
  mp4: 'video', webm: 'video', m4v: 'video',
  mp3: 'audio', m4a: 'audio', ogg: 'audio', oga: 'audio', wav: 'audio'
};

/** Returns an error message if the file's content does not match its extension, else null. */
export function checkUploadFile(filePath, fileName) {
  const ext = String(fileName || '').split('.').pop().toLowerCase();
  const kind = EXT_KIND[ext];
  if (!kind) return null; // other whitelisted types (pdf, docx, vtt …) are delivered as attachments
  let head;
  try {
    const fd = fs.openSync(filePath, 'r');
    head = Buffer.alloc(16);
    fs.readSync(fd, head, 0, 16, 0);
    fs.closeSync(fd);
  } catch {
    return 'Datei konnte nicht gelesen werden.';
  }
  return kindMatches(kind, head) ? null : 'Der Dateiinhalt passt nicht zur Dateiendung.';
}
