import { useState } from 'react';
import QRCode from 'react-qr-code';
import { useLang } from '@/context/LanguageContext';

interface RoomJoinQRProps {
  roomCode: string;
  mode: 'forehead' | 'character' | 'charades' | 'dykm';
}

export default function RoomJoinQR({ roomCode, mode }: RoomJoinQRProps) {
  const { lang } = useLang();
  const isAr = lang === 'ar';
  const [codeCopied, setCodeCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
  const joinUrl = `${window.location.origin}${base}/${mode}?room=${roomCode}`;

  if (!roomCode) return null;

  const handleCopyCode = async () => {
    try { await navigator.clipboard.writeText(roomCode); } catch {}
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: isAr ? 'انضم إلى لعبتي!' : 'Join my game!',
          text: isAr ? `انضم! الرمز: ${roomCode}` : `Join! Code: ${roomCode}`,
          url: joinUrl,
        });
        return;
      }
    } catch {}
    try { await navigator.clipboard.writeText(joinUrl); } catch {}
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2500);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
      padding: '14px 14px 12px',
      background: '#0d0d14',
      border: '3px solid #a855f7',
      boxShadow: '5px 5px 0 #000, 0 0 20px rgba(168,85,247,0.25)',
    }}>
      {/* QR code */}
      <div style={{
        padding: 8,
        background: '#fff',
        display: 'inline-block',
        lineHeight: 0,
        boxShadow: '2px 2px 0 rgba(0,0,0,0.4)',
      }}>
        <QRCode value={joinUrl} size={176} />
      </div>

      {/* Labels */}
      <div style={{ textAlign: 'center', lineHeight: 1.3 }}>
        <p style={{
          color: '#c084fc',
          fontWeight: 900,
          fontSize: 13,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          direction: isAr ? 'rtl' : 'ltr',
          margin: 0,
        }}>
          {isAr ? 'امسح الكود للدخول' : 'SCAN TO JOIN'}
        </p>
        <p style={{
          color: 'rgba(255,255,255,0.35)',
          fontSize: 11,
          marginTop: 3,
          letterSpacing: '0.05em',
          direction: isAr ? 'rtl' : 'ltr',
          margin: '3px 0 0',
        }}>
          {isAr ? 'أو أدخل الرمز يدويًا' : 'or enter the code manually'}
        </p>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8, width: '100%' }}>
        <button
          onClick={handleCopyCode}
          style={{
            flex: 1,
            padding: '9px 0',
            background: codeCopied ? '#16a34a' : 'transparent',
            border: `2px solid ${codeCopied ? '#16a34a' : '#a855f7'}`,
            color: codeCopied ? '#fff' : '#c084fc',
            fontWeight: 800,
            fontSize: 11,
            letterSpacing: '0.12em',
            cursor: 'pointer',
            transition: 'all 0.15s',
            textTransform: 'uppercase',
          }}
        >
          {codeCopied
            ? (isAr ? '✓ تم' : '✓ COPIED')
            : (isAr ? 'نسخ الرمز' : 'COPY CODE')}
        </button>
        <button
          onClick={handleShare}
          style={{
            flex: 1,
            padding: '9px 0',
            background: urlCopied ? '#16a34a' : '#7c3aed',
            border: 'none',
            color: '#fff',
            fontWeight: 800,
            fontSize: 11,
            letterSpacing: '0.12em',
            cursor: 'pointer',
            transition: 'background 0.15s',
            textTransform: 'uppercase',
            boxShadow: urlCopied ? 'none' : '2px 2px 0 #000',
          }}
        >
          {urlCopied
            ? (isAr ? '✓ تم النسخ' : '✓ LINK COPIED')
            : (isAr ? 'مشاركة' : 'SHARE LINK')}
        </button>
      </div>
    </div>
  );
}
