import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { CertificateData } from '../types';

type CertificateExtras = {
  institution?: string;       // e.g. "Tıpta Profesyonellik Bloğu"
  departmentOrUnit?: string;  // e.g. "Araştırma ve Geliştirme Birimi"
  coordinatorTitle?: string;  // e.g. "Koordinatör" / "Sorumlu Öğretim Üyesi"
  coordinatorName?: string;   // e.g. "Dr. Öğr. Üyesi Ayşe Yılmaz"
  location?: string;          // e.g. "İstanbul"
  certificateNo?: string;     // e.g. "2025-TPB-0142"
};

type CertificateInput = CertificateData & CertificateExtras;

// ---------- Helper: Transliterate Turkish to ASCII ----------
const sanitizeText = (text: string): string => {
  return text
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C')
    .replace(/â/g, 'a').replace(/Â/g, 'A');
};

// ---------- Font loading (Unicode-safe) ----------
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const fetchFirstAvailable = async (urls: string[]): Promise<ArrayBuffer> => {
  let lastErr: unknown = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { mode: 'cors', cache: 'force-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.arrayBuffer();
    } catch (e) {
      console.warn(`Failed to fetch font from ${url}`, e);
      lastErr = e;
    }
  }
  throw lastErr ?? new Error('All font mirrors failed.');
};

const loadCustomFonts = async (doc: jsPDF): Promise<boolean> => {
  try {
    const regularBuf = await fetchFirstAvailable([
      'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf',
      'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5Q.ttf'
    ]);

    const boldBuf = await fetchFirstAvailable([
      'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf',
      'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4.ttf'
    ]);

    doc.addFileToVFS('Roboto-Regular.ttf', arrayBufferToBase64(regularBuf));
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');

    doc.addFileToVFS('Roboto-Bold.ttf', arrayBufferToBase64(boldBuf));
    doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');

    return true;
  } catch (e) {
    console.error('CRITICAL: Font loading failed. Turkish characters will be transliterated.', e);
    return false;
  }
};

// ---------- QR helper ----------
const buildQrDataUrl = async (url: string): Promise<string> => {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 8,
    color: { dark: '#0f172a', light: '#ffffff' }
  });
};

// ---------- Decorations ----------
const drawAtom = (doc: jsPDF, x: number, y: number, scale: number) => {
  doc.setDrawColor(71, 85, 105);
  doc.setLineWidth(0.4 * scale);

  doc.setFillColor(8, 51, 68);
  doc.circle(x, y, 2.5 * scale, 'F');

  doc.setDrawColor(8, 51, 68);
  doc.ellipse(x, y, 9 * scale, 3 * scale, 'S');
  doc.ellipse(x, y, 3 * scale, 9 * scale, 'S');
  doc.circle(x, y, 7 * scale, 'S');

  doc.setFillColor(6, 182, 212);
  doc.circle(x + 9 * scale, y, 1 * scale, 'F');
  doc.circle(x, y - 9 * scale, 1 * scale, 'F');
  doc.circle(x - 5 * scale, y + 5 * scale, 1 * scale, 'F');
};

const drawDNAHelix = (doc: jsPDF, x: number, y: number, height: number, scale: number) => {
  const width = 14 * scale;
  const steps = 12;
  const stepHeight = height / steps;

  for (let i = 0; i < steps; i++) {
    const curY = y + i * stepHeight;
    const offset1 = Math.sin(i * 0.9) * (width / 2);
    const offset2 = Math.sin(i * 0.9 + Math.PI) * (width / 2);

    const x1 = x + width / 2 + offset1;
    const x2 = x + width / 2 + offset2;

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.5 * scale);
    doc.line(x1, curY, x2, curY);

    doc.setFillColor(8, 51, 68);
    doc.circle(x1, curY, 1.2 * scale, 'F');
    doc.circle(x2, curY, 1.2 * scale, 'F');
  }
};

const drawMicroscope = (doc: jsPDF, x: number, y: number, scale: number) => {
  doc.setDrawColor(8, 51, 68);
  doc.setFillColor(8, 51, 68);
  doc.setLineWidth(0.6 * scale);

  doc.rect(x - 6 * scale, y + 8 * scale, 12 * scale, 2 * scale, 'F');
  doc.line(x - 3 * scale, y + 8 * scale, x - 3 * scale, y - 2 * scale);
  doc.line(x - 3 * scale, y - 2 * scale, x + 2 * scale, y - 5 * scale);

  doc.rect(x + 1 * scale, y - 8 * scale, 2.5 * scale, 6 * scale, 'S');
  doc.line(x + 2 * scale, y - 8 * scale, x + 5 * scale, y - 8 * scale);

  doc.setLineWidth(1 * scale);
  doc.line(x - 3 * scale, y + 4 * scale, x + 4 * scale, y + 4 * scale);
};

// ---------- Main generator ----------
export const generateCertificatePDF = async (data: CertificateInput) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const fontLoaded = await loadCustomFonts(doc);
  const t = (text: string) => (fontLoaded ? text : sanitizeText(text));

  const setFont = (style: 'normal' | 'bold') => {
    if (fontLoaded) doc.setFont('Roboto', style);
    else doc.setFont('times', style);
  };

  // Build QR (GitHub)
  const qrUrl = 'https://github.com/ProfResearchers';
  const qrDataUrl = await buildQrDataUrl(qrUrl);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const centerX = pageWidth / 2;

  const institution = data.institution ?? 'Tıpta Profesyonellik Bloğu';
  const unit = data.departmentOrUnit ?? 'Bilimsel Araştırmalar ve Uygulamalar';
  const coordinatorTitle = data.coordinatorTitle ?? 'Koordinatör';
  const coordinatorName = data.coordinatorName ?? '';
  const location = data.location ?? '';
  const certificateNo = data.certificateNo ?? '';

  // Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Subtle watermark
  doc.saveGraphicsState();
  setFont('bold');
  doc.setFontSize(56);
  doc.setTextColor(241, 245, 249);

  doc.text('PROFRESEARCHERS', centerX, pageHeight / 2 + 10, { align: 'center', angle: 18 });
  doc.restoreGraphicsState();

  // Borders
  doc.setDrawColor(8, 51, 68);
  doc.setLineWidth(2.5);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

  doc.setDrawColor(22, 78, 99);
  doc.setLineWidth(0.8);
  doc.rect(12, 12, pageWidth - 24, pageHeight - 24);

  // Decorations
  drawDNAHelix(doc, 20, 35, 120, 0.9);
  drawDNAHelix(doc, pageWidth - 35, 35, 120, 0.9);

  drawAtom(doc, 22, 22, 1.3);
  drawAtom(doc, pageWidth - 22, 22, 1.3);
  drawAtom(doc, 22, pageHeight - 22, 1.3);
  drawAtom(doc, pageWidth - 22, pageHeight - 22, 1.3);

  // Header emblem
  doc.setDrawColor(22, 78, 99);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(1);
  doc.circle(centerX, 36, 12, 'FD');
  drawMicroscope(doc, centerX, 36, 0.9);

  // Institution lines
  setFont('normal');
  doc.setFontSize(12);
  doc.setTextColor(51, 65, 85);
  doc.text(t(institution), centerX, 55, { align: 'center' });

  doc.setFontSize(10.5);
  doc.setTextColor(100, 116, 139);
  doc.text(t(unit), centerX, 61, { align: 'center' });

  // Title
  setFont('bold');
  doc.setFontSize(32);
  doc.setTextColor(22, 78, 99);
  doc.text(t('GÖNÜLLÜ KATILIM SERTİFİKASI'), centerX, 78, { align: 'center' });

  // Accent line under title
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.6);
  doc.line(centerX - 55, 82, centerX + 55, 82);

  // Intro paragraph
  setFont('normal');
  doc.setFontSize(14);
  doc.setTextColor(51, 65, 85);

  const introRaw =
    'Bu sertifika, yürütülen bilimsel çalışmalara gönüllü katılımı ve sunduğu değerli katkılar nedeniyle aşağıda adı yazılı katılımcıya takdim edilmiştir.';
  const introLines = doc.splitTextToSize(t(introRaw), pageWidth - 90);
  doc.text(introLines, centerX, 92, { align: 'center', lineHeightFactor: 1.45 });

  // Name (dynamic sizing)
  const rawName = data.name.toLocaleUpperCase('tr-TR');
  const cleanName = t(rawName);

  setFont('bold');
  doc.setTextColor(15, 23, 42);

  let nameFontSize = 40;
  doc.setFontSize(nameFontSize);

  const maxNameWidth = pageWidth - 90;
  while (doc.getTextWidth(cleanName) > maxNameWidth && nameFontSize > 20) {
    nameFontSize -= 2;
    doc.setFontSize(nameFontSize);
  }

  const nameY = 122;
  doc.text(cleanName, centerX, nameY, { align: 'center' });

  // Underline
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(centerX - 55, nameY + 8, centerX + 55, nameY + 8);

  // Impact message
  const impactRaw = (data.impactMessage ?? '').trim();
  const impactTextBase =
    impactRaw.length > 0
      ? impactRaw
      : 'Katkılarınız, araştırma sürecimizin niteliğini ve güvenilirliğini güçlendirmiştir.';

  setFont('normal');
  doc.setFontSize(12.5);
  doc.setTextColor(71, 85, 105);

  const impactLines = doc.splitTextToSize(t(impactTextBase), pageWidth - 100);
  const impactY = 142;
  doc.text(impactLines, centerX, impactY, { align: 'center', lineHeightFactor: 1.5 });

  // Closing line
  doc.setFontSize(12.5);
  doc.setTextColor(51, 65, 85);
  const closingRaw =
    'Sayın katılımcımıza teşekkür eder, akademik ve mesleki yaşamında başarılarının devamını dileriz.';
  const closingLines = doc.splitTextToSize(t(closingRaw), pageWidth - 90);

  const closingY = impactY + impactLines.length * 7.2 + 8;
  doc.text(closingLines, centerX, closingY, { align: 'center', lineHeightFactor: 1.35 });

  // Footer
  const footerY = pageHeight - 28;

  // QR card (left)
  const qrSize = 24;
  const qrCardPadding = 3;
  const qrX = 18;
  const qrY = pageHeight - 44;

  // Card background
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.6);
  doc.roundedRect(qrX - qrCardPadding, qrY - qrCardPadding, qrSize + qrCardPadding * 2, qrSize + qrCardPadding * 2, 2.5, 2.5, 'FD');

  // QR image
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

  // Small label under QR (inside footer area)
  setFont('bold');
  doc.setFontSize(9);
  doc.setTextColor(22, 78, 99);
  doc.text('ProfResearchers', qrX + qrSize / 2, qrY + qrSize + 7, { align: 'center' });

  // Left text shifted right to make room for QR
  const leftX = qrX + qrSize + 12;

  setFont('normal');
  doc.setFontSize(10.5);
  doc.setTextColor(100, 116, 139);

  const dateLabel = t('Düzenlenme Tarihi');
  const locPart = location ? `${t(location)}, ` : '';
  doc.text(`${locPart}${dateLabel}: ${data.date}`, leftX, footerY);

  if (certificateNo) {
    doc.setFontSize(9.5);
    doc.text(`${t('Belge No')}: ${certificateNo}`, leftX, footerY + 6);
  }

  // GitHub URL (clickable area)
  doc.setFontSize(9.5);
  doc.setTextColor(22, 78, 99);
  const urlText = t('Doğrulama / GitHub: ') + qrUrl;
  doc.text(urlText, leftX, footerY + 12);

  // clickable link rectangle (only on URL part)
  const prefix = t('Doğrulama / GitHub: ');
  const prefixW = doc.getTextWidth(prefix);
  const urlW = doc.getTextWidth(qrUrl);
  doc.link(leftX + prefixW, footerY + 12 - 4, urlW, 6, { url: qrUrl });

  // Right: signature
  const sigX = pageWidth - 78;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(sigX, footerY - 6, sigX + 48, footerY - 6);

  setFont('bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(t(coordinatorTitle), sigX + 24, footerY, { align: 'center' });

  if (coordinatorName.trim()) {
    setFont('normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    doc.text(t(coordinatorName), sigX + 24, footerY + 5.5, { align: 'center' });
  }

  // Save
  const safeFileName = sanitizeText(data.name)
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '_');

  doc.save(`${safeFileName}_GonulluKatilimSertifikasi.pdf`);
};
