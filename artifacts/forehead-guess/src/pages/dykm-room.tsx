import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameSocket, type RoomState, type DykmState, type DykmQuestion } from '@/hooks/useGameSocket';
import { useLang } from '@/context/LanguageContext';
import { fetchDykmQuestionsFromSupabase, getDykmCategories } from '@/lib/supabase-dykm';
import RoomJoinQR from '@/components/RoomJoinQR';
import PetalSwoop from '@/components/PetalSwoop';
import grassBg from '@assets/6E21F754-65A0-4119-A739-67DD40CAA6B4_1780250343871.png';

// ── palette ──────────────────────────────────────────────────────────────────
const CREAM     = '#fdf6ee';
const MAROON    = '#8b0000';   // deep blood red — matches petals
const ROSE      = '#c0392b';   // medium red
const TEAL      = '#3d7a6a';   // forest teal
const PARCHMENT = '#f0e4d0';

const FONT_MONO = "Georgia, 'Times New Roman', serif";

// ── sub-components ────────────────────────────────────────────────────────────

function CrtScanlines() {
  return null;
}

function VhsBadge({ text }: { text: string }) {
  return (
    <span style={{
      fontFamily: FONT_MONO,
      fontSize: 10,
      letterSpacing: '0.25em',
      color: TEAL,
      background: 'rgba(107,158,159,0.12)',
      border: `1px solid ${TEAL}`,
      padding: '2px 8px',
      display: 'inline-block',
    }}>
      {text}
    </span>
  );
}

function ScoreBar({ score, target }: { score: number; target: number }) {
  const pct = Math.min(100, (score / target) * 100);
  return (
    <div style={{
      height: 6,
      background: 'rgba(92,32,48,0.15)',
      borderRadius: 0,
      overflow: 'hidden',
      marginTop: 4,
    }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        background: `linear-gradient(90deg, ${ROSE} 0%, ${MAROON} 100%)`,
        transition: 'width 0.4s ease',
      }} />
    </div>
  );
}

// Newsreel / ticket-tape question strip
function QuestionNewsreel({ questions, lang, error, loading }: { questions: DykmQuestion[]; lang: string; error?: string | null; loading?: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const isAr = lang === 'ar';

  // Auto-scroll every 8 seconds
  useEffect(() => {
    if (questions.length <= 1) return;
    const id = setInterval(() => {
      setOffset(o => (o + 1) % questions.length);
    }, 8000);
    return () => clearInterval(id);
  }, [questions.length]);

  const prev = () => setOffset(o => (o - 1 + questions.length) % questions.length);
  const next = () => setOffset(o => (o + 1) % questions.length);

  const q = questions[offset];
  if (!q) return (
    <div style={{
      background: CREAM,
      border: `2px solid ${MAROON}`,
      padding: '20px 24px',
      fontFamily: FONT_MONO,
      color: MAROON,
      textAlign: 'center',
      fontSize: 13,
      wordBreak: 'break-word',
    }}>
      {error
        ? <><span style={{ color: ROSE, letterSpacing: '0.1em' }}>⚠ LOAD ERROR</span><br /><span style={{ fontSize: 11, opacity: 0.8 }}>{error}</span></>
        : loading
          ? (isAr ? 'جاري تحميل الأسئلة…' : 'Loading questions…')
          : (isAr ? 'لا توجد أسئلة في قاعدة البيانات بعد' : 'No questions in database yet')}
    </div>
  );

  return (
    <div style={{ position: 'relative' }}>
      {/* Accent strip top */}
      <div style={{ height: 3, background: MAROON, marginBottom: 2 }} />

      {/* Question card */}
      <div style={{
        background: CREAM,
        border: `2px solid ${MAROON}`,
        padding: '16px 48px',
        minHeight: 88,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative corner marks */}
        {['top-left','top-right','bottom-left','bottom-right'].map(pos => (
          <div key={pos} style={{
            position: 'absolute',
            width: 12, height: 12,
            borderTop: pos.includes('top') ? `2px solid ${ROSE}` : undefined,
            borderBottom: pos.includes('bottom') ? `2px solid ${ROSE}` : undefined,
            borderLeft: pos.includes('left') ? `2px solid ${ROSE}` : undefined,
            borderRight: pos.includes('right') ? `2px solid ${ROSE}` : undefined,
            top: pos.includes('top') ? 6 : undefined,
            bottom: pos.includes('bottom') ? 6 : undefined,
            left: pos.includes('left') ? 6 : undefined,
            right: pos.includes('right') ? 6 : undefined,
          }} />
        ))}

        <p
          ref={trackRef}
          style={{
            fontFamily: isAr ? "'Changa', sans-serif" : FONT_MONO,
            fontSize: isAr ? 'clamp(14px, 4vw, 20px)' : 'clamp(13px, 3.5vw, 18px)',
            fontWeight: 700,
            color: MAROON,
            textAlign: 'center',
            direction: isAr ? 'rtl' : 'ltr',
            lineHeight: 1.4,
            letterSpacing: isAr ? undefined : '0.02em',
          }}
        >
          {q.question}
        </p>

        {/* Nav arrows */}
        {questions.length > 1 && (
          <>
            <button
              onClick={prev}
              style={{
                position: 'absolute',
                left: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: MAROON,
                fontSize: 18,
                padding: '4px 6px',
                opacity: 0.6,
              }}
            >◀</button>
            <button
              onClick={next}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: MAROON,
                fontSize: 18,
                padding: '4px 6px',
                opacity: 0.6,
              }}
            >▶</button>
          </>
        )}
      </div>

      {/* Category badge + counter */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 0',
      }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: TEAL, letterSpacing: '0.2em' }}>
          [{q.categoryName}]
        </span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: ROSE, letterSpacing: '0.15em' }}>
          {offset + 1}/{questions.length}
        </span>
      </div>

      {/* Accent strip bottom */}
      <div style={{ height: 3, background: MAROON, marginTop: 2 }} />
    </div>
  );
}

// ── props ─────────────────────────────────────────────────────────────────────

interface Props {
  code: string;
  playerId: number;
  roomState: RoomState;
  socket: ReturnType<typeof useGameSocket>;
  onGoHome: () => void;
}

// ── main component ────────────────────────────────────────────────────────────

export default function DykmRoom({ code, playerId, roomState, socket, onGoHome }: Props) {
  const { lang } = useLang();
  const isAr = lang === 'ar';

  const {
    dykmState,
    dykmStart,
    dykmSetAsker,
    dykmAwardPoint,
    dykmUndoPoint,
    dykmEndGame,
    dykmBackToLobby,
    dykmSelectQuestion,
  } = socket;

  const [allQuestions, setAllQuestions] = useState<DykmQuestion[]>([]);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedScore, setSelectedScore] = useState<3 | 10>(3);
  const [selectedAskerId, setSelectedAskerId] = useState<number>(playerId);

  const isHost = roomState.players.find(p => p.id === playerId)?.isHost ?? false;
  const roomLang = (roomState as any).lang ?? lang;

  // Load questions from Supabase once
  useEffect(() => {
    setQuestionsLoading(true);
    fetchDykmQuestionsFromSupabase().then(({ questions, error }) => {
      setAllQuestions(questions);
      setQuestionsError(error);
      setQuestionsLoading(false);
    });
  }, []);

  const categories = getDykmCategories(allQuestions);
  const questions = selectedCategory
    ? allQuestions.filter(q => q.categoryName === selectedCategory)
    : allQuestions;

  // Default asker = first player
  useEffect(() => {
    if (roomState.players.length > 0 && !selectedAskerId) {
      setSelectedAskerId(roomState.players[0].id);
    }
  }, [roomState.players, selectedAskerId]);

  const handleStart = () => {
    dykmStart(selectedScore, selectedAskerId);
  };

  const handleSetAsker = (id: number) => {
    dykmSetAsker(id);
  };

  // ── LOBBY ──────────────────────────────────────────────────────────────────
  if (roomState.status === 'waiting') {
    return (
      <div style={{ position: 'relative', minHeight: '100dvh', background: `linear-gradient(rgba(10,28,10,0.22), rgba(10,28,10,0.22)), url(${grassBg}) center/cover no-repeat`, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <CrtScanlines />
        <PetalSwoop />

        {/* Header */}
        <div style={{
          background: MAROON,
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <VhsBadge text="▶ REC" />
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: PARCHMENT, letterSpacing: '0.3em' }}>
            {isAr ? 'هل تعرفني؟' : 'DO YOU KNOW ME?'}
          </span>
          <span style={{ width: 40 }} />
        </div>

        <div style={{ flex: 1, padding: '24px 16px', maxWidth: 480, margin: '0 auto', width: '100%' }}>
          {/* Room code — large and centered */}
          <div style={{
            textAlign: 'center',
            marginBottom: 16,
            padding: '20px 0 16px',
          }}>
            <p style={{ fontFamily: FONT_MONO, fontSize: 9, color: TEAL, letterSpacing: '0.45em', textTransform: 'uppercase', marginBottom: 8 }}>
              {isAr ? 'رمز الغرفة' : 'ROOM CODE'}
            </p>
            <p style={{ fontFamily: FONT_MONO, fontSize: 'clamp(40px, 11vw, 58px)', fontWeight: 900, color: 'white', letterSpacing: '0.3em', lineHeight: 1, textShadow: `3px 3px 0 ${MAROON}, 0 0 20px rgba(139,0,0,0.55)` }}>
              {code}
            </p>
          </div>

          <RoomJoinQR roomCode={code} mode="dykm" />

          <div style={{ height: 1, background: 'rgba(92,32,48,0.15)', margin: '16px 0 12px' }} />

          {/* Players */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontFamily: FONT_MONO, fontSize: 10, color: TEAL, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 8 }}>
              PLAYERS ({roomState.players.length})
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {roomState.players.map(p => (
                <div key={p.id} style={{
                  fontFamily: isAr ? "'Changa', sans-serif" : FONT_MONO,
                  fontSize: 13,
                  padding: '4px 12px',
                  background: p.id === playerId ? MAROON : PARCHMENT,
                  color: p.id === playerId ? CREAM : MAROON,
                  border: `1.5px solid ${MAROON}`,
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                }}>
                  {p.name}
                  {p.isHost && <span style={{ fontSize: 9, color: ROSE, letterSpacing: '0.2em' }}>HOST</span>}
                </div>
              ))}
            </div>
          </div>

          {isHost && (
            <>
              {/* Target score */}
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontFamily: FONT_MONO, fontSize: 10, color: TEAL, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 10 }}>
                  {isAr ? 'نقاط للفوز' : 'TARGET SCORE'}
                </p>
                <div style={{ display: 'flex', gap: 12 }}>
                  {([3, 10] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setSelectedScore(s)}
                      style={{
                        flex: 1,
                        padding: '12px 0',
                        background: selectedScore === s ? MAROON : PARCHMENT,
                        color: selectedScore === s ? CREAM : MAROON,
                        border: `2px solid ${MAROON}`,
                        fontFamily: FONT_MONO,
                        fontSize: 22,
                        fontWeight: 900,
                        cursor: 'pointer',
                        boxShadow: selectedScore === s ? `3px 3px 0 ${ROSE}` : 'none',
                        transition: 'all 0.15s',
                      }}
                    >
                      {s}
                      <div style={{ fontSize: 9, letterSpacing: '0.2em', marginTop: 2, opacity: 0.7 }}>
                        {s === 3 ? (isAr ? 'سريع' : 'QUICK') : (isAr ? 'طويل' : 'LONG')}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Starting asker */}
              <div style={{ marginBottom: 28 }}>
                <p style={{ fontFamily: FONT_MONO, fontSize: 10, color: TEAL, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 10 }}>
                  {isAr ? 'البداية مع' : 'STARTING ASKER'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {roomState.players.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedAskerId(p.id)}
                      style={{
                        padding: '10px 16px',
                        background: selectedAskerId === p.id ? MAROON : PARCHMENT,
                        color: selectedAskerId === p.id ? CREAM : MAROON,
                        border: `2px solid ${selectedAskerId === p.id ? MAROON : ROSE}`,
                        fontFamily: isAr ? "'Changa', sans-serif" : FONT_MONO,
                        fontSize: 15,
                        cursor: 'pointer',
                        textAlign: isAr ? 'right' : 'left',
                        direction: isAr ? 'rtl' : 'ltr',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span>{p.name}</span>
                      {selectedAskerId === p.id && (
                        <span style={{ fontSize: 11, color: ROSE, letterSpacing: '0.2em' }}>▶ ASKER</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleStart}
                disabled={roomState.players.length < 2}
                style={{
                  width: '100%',
                  padding: '16px 0',
                  background: MAROON,
                  color: CREAM,
                  border: 'none',
                  fontFamily: isAr ? "'Changa', sans-serif" : FONT_MONO,
                  fontSize: 18,
                  fontWeight: 900,
                  letterSpacing: '0.1em',
                  cursor: roomState.players.length < 2 ? 'not-allowed' : 'pointer',
                  opacity: roomState.players.length < 2 ? 0.5 : 1,
                  boxShadow: `4px 4px 0 ${ROSE}`,
                }}
              >
                {isAr ? 'ابدأ اللعبة!' : 'START GAME!'}
              </button>

              {roomState.players.length < 2 && (
                <p style={{
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  color: ROSE,
                  textAlign: 'center',
                  marginTop: 10,
                  letterSpacing: '0.1em',
                }}>
                  {isAr ? 'تحتاج لاعبَين على الأقل' : 'Need at least 2 players'}
                </p>
              )}
            </>
          )}

          {!isHost && (
            <div style={{
              marginTop: 40,
              textAlign: 'center',
              fontFamily: isAr ? "'Changa', sans-serif" : FONT_MONO,
              color: MAROON,
              fontSize: 15,
              opacity: 0.8,
            }}>
              {isAr ? 'انتظر المضيف لبدء اللعبة…' : 'Waiting for host to start…'}
              <div style={{
                marginTop: 16,
                display: 'flex',
                justifyContent: 'center',
                gap: 8,
              }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6,
                    background: ROSE,
                    animation: `pulse 1.4s ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onGoHome}
            style={{
              marginTop: 32,
              width: '100%',
              padding: '10px 0',
              background: 'transparent',
              color: TEAL,
              border: `1.5px solid ${TEAL}`,
              fontFamily: FONT_MONO,
              fontSize: 12,
              letterSpacing: '0.2em',
              cursor: 'pointer',
            }}
          >
            {isAr ? '← خروج' : '← LEAVE ROOM'}
          </button>
        </div>

        <style>{`
          @keyframes pulse {
            0%,100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.4); }
          }
        `}</style>
      </div>
    );
  }

  // ── PLAYING ────────────────────────────────────────────────────────────────
  if (roomState.status === 'dykm_playing' && dykmState) {
    const ds: DykmState = dykmState;
    const players = ds.players ?? roomState.players.map(p => ({ ...p }));
    const amAsker = ds.askerId === playerId;
    const amHost = isHost;
    const nonAskerPlayers = players.filter(p => p.id !== ds.askerId);

    return (
      <div style={{
        position: 'relative',
        minHeight: '100dvh',
        background: `linear-gradient(rgba(10,28,10,0.22), rgba(10,28,10,0.22)), url(${grassBg}) center/cover no-repeat`,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}>
        <CrtScanlines />
        <PetalSwoop />

        {/* Header bar */}
        <div style={{
          background: MAROON,
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <VhsBadge text="▶ REC" />
          </div>
          <div style={{
            fontFamily: isAr ? "'Changa', sans-serif" : FONT_MONO,
            fontSize: 11,
            color: PARCHMENT,
            letterSpacing: '0.15em',
            textAlign: 'center',
          }}>
            {isAr ? 'السائل:' : 'ASKER:'} <span style={{ color: ROSE }}>{ds.askerName}</span>
          </div>
          <div style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: ROSE,
            letterSpacing: '0.15em',
          }}>
            🎯 {ds.targetScore}
          </div>
        </div>

        <div style={{ flex: 1, padding: '12px 14px 24px', maxWidth: 520, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Question section — asker picks, everyone sees the same */}
          {amAsker ? (
            <div>
              {/* Show currently selected question */}
              {ds.selectedQuestion && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontFamily: FONT_MONO, fontSize: 9, color: TEAL, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>
                    {isAr ? 'السؤال الحالي' : 'CURRENT QUESTION'}
                  </p>
                  <div style={{ background: MAROON, border: `2px solid ${ROSE}`, padding: '12px 16px' }}>
                    <p style={{
                      fontFamily: isAr ? "'Changa', sans-serif" : FONT_MONO,
                      fontSize: isAr ? 16 : 14,
                      color: CREAM,
                      textAlign: 'center',
                      direction: isAr ? 'rtl' : 'ltr',
                      lineHeight: 1.4,
                    }}>
                      {ds.selectedQuestion.question}
                    </p>
                    <p style={{ fontFamily: FONT_MONO, fontSize: 9, color: ROSE, textAlign: 'center', marginTop: 4, letterSpacing: '0.2em' }}>
                      [{ds.selectedQuestion.categoryName}]
                    </p>
                  </div>
                </div>
              )}

              {/* Category filter */}
              <p style={{ fontFamily: FONT_MONO, fontSize: 9, color: TEAL, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 8 }}>
                {isAr ? 'اختر سؤالاً' : 'PICK A QUESTION'}
              </p>
              {categories.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  <button
                    onClick={() => setSelectedCategory(null)}
                    style={{
                      padding: '5px 12px',
                      background: selectedCategory === null ? MAROON : PARCHMENT,
                      color: selectedCategory === null ? CREAM : MAROON,
                      border: `1.5px solid ${MAROON}`,
                      fontFamily: FONT_MONO, fontSize: 10, letterSpacing: '0.15em', cursor: 'pointer',
                    }}
                  >
                    {isAr ? 'الكل' : 'ALL'}
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      style={{
                        padding: '5px 12px',
                        background: selectedCategory === cat ? MAROON : PARCHMENT,
                        color: selectedCategory === cat ? CREAM : MAROON,
                        border: `1.5px solid ${selectedCategory === cat ? MAROON : ROSE}`,
                        fontFamily: isAr ? "'Changa', sans-serif" : FONT_MONO,
                        fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer',
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {/* Scrollable question list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
                {questionsLoading ? (
                  <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: TEAL }}>
                    {isAr ? 'جاري التحميل…' : 'Loading…'}
                  </p>
                ) : questions.length === 0 ? (
                  <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: ROSE }}>
                    {isAr ? 'لا توجد أسئلة' : 'No questions found'}
                  </p>
                ) : questions.map(q => (
                  <button
                    key={q.id}
                    onClick={() => dykmSelectQuestion({ id: q.id, question: q.question, categoryName: q.categoryName })}
                    style={{
                      background: ds.selectedQuestion?.id === q.id ? MAROON : PARCHMENT,
                      color: ds.selectedQuestion?.id === q.id ? CREAM : MAROON,
                      border: `1.5px solid ${ds.selectedQuestion?.id === q.id ? MAROON : ROSE}`,
                      padding: '9px 12px',
                      textAlign: isAr ? 'right' : 'left',
                      direction: isAr ? 'rtl' : 'ltr',
                      fontFamily: isAr ? "'Changa', sans-serif" : FONT_MONO,
                      fontSize: 13,
                      cursor: 'pointer',
                      lineHeight: 1.4,
                      display: 'block',
                      width: '100%',
                    }}
                  >
                    {q.question}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              {ds.selectedQuestion ? (
                <>
                  <p style={{ fontFamily: FONT_MONO, fontSize: 9, color: TEAL, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>
                    {isAr ? 'السؤال' : 'QUESTION'}
                  </p>
                  <div style={{ height: 3, background: MAROON, marginBottom: 2 }} />
                  <div style={{
                    background: CREAM,
                    border: `2px solid ${MAROON}`,
                    padding: '20px 24px',
                    minHeight: 80,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <p style={{
                      fontFamily: isAr ? "'Changa', sans-serif" : FONT_MONO,
                      fontSize: isAr ? 'clamp(15px, 4.5vw, 22px)' : 'clamp(13px, 3.5vw, 18px)',
                      fontWeight: 700,
                      color: MAROON,
                      textAlign: 'center',
                      direction: isAr ? 'rtl' : 'ltr',
                      lineHeight: 1.4,
                    }}>
                      {ds.selectedQuestion.question}
                    </p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '4px 0', marginTop: 2 }}>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: TEAL, letterSpacing: '0.2em' }}>
                      [{ds.selectedQuestion.categoryName}]
                    </span>
                  </div>
                  <div style={{ height: 3, background: MAROON, marginTop: 2 }} />
                </>
              ) : (
                <div style={{
                  background: PARCHMENT,
                  border: `1.5px dashed ${ROSE}`,
                  padding: '20px 24px',
                  textAlign: 'center',
                  fontFamily: isAr ? "'Changa', sans-serif" : FONT_MONO,
                  color: MAROON,
                  fontSize: 13,
                  opacity: 0.7,
                  direction: isAr ? 'rtl' : 'ltr',
                }}>
                  {isAr ? `${ds.askerName} يختار سؤالاً…` : `Waiting for ${ds.askerName} to pick a question…`}
                </div>
              )}
            </div>
          )}

          {/* Asker label */}
          {amAsker && (
            <div style={{
              background: TEAL,
              color: CREAM,
              fontFamily: isAr ? "'Changa', sans-serif" : FONT_MONO,
              fontSize: 12,
              letterSpacing: '0.15em',
              textAlign: 'center',
              padding: '6px 0',
              textTransform: 'uppercase',
            }}>
              {isAr ? '🎙 أنت السائل — اضغط + لمنح نقطة' : '🎙 YOU ARE THE ASKER — tap + to award points'}
            </div>
          )}

          {/* Player cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {nonAskerPlayers.map(player => {
              const score = ds.scores?.[player.id] ?? 0;
              const canAward = amAsker && ds.status === 'playing';
              return (
                <div
                  key={player.id}
                  style={{
                    background: player.id === playerId ? CREAM : PARCHMENT,
                    border: `2px solid ${player.id === playerId ? MAROON : ROSE}`,
                    padding: '12px 14px',
                    boxShadow: player.id === playerId ? `3px 3px 0 ${ROSE}` : 'none',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontFamily: isAr ? "'Changa', sans-serif" : FONT_MONO,
                        fontSize: 16,
                        fontWeight: 700,
                        color: MAROON,
                        direction: isAr ? 'rtl' : 'ltr',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {player.name}
                        {player.id === playerId && (
                          <span style={{ fontSize: 10, color: TEAL, marginLeft: 8, letterSpacing: '0.2em' }}>(YOU)</span>
                        )}
                      </p>
                      <p style={{
                        fontFamily: FONT_MONO,
                        fontSize: 13,
                        color: ROSE,
                        letterSpacing: '0.05em',
                        marginTop: 2,
                      }}>
                        {score} / {ds.targetScore} pts
                      </p>
                      <ScoreBar score={score} target={ds.targetScore} />
                    </div>

                    {/* Award / undo buttons */}
                    {canAward && (
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button
                          onClick={() => dykmUndoPoint(player.id)}
                          disabled={score === 0}
                          style={{
                            width: 36,
                            height: 36,
                            background: 'transparent',
                            border: `1.5px solid ${ROSE}`,
                            color: ROSE,
                            fontFamily: FONT_MONO,
                            fontSize: 18,
                            cursor: score === 0 ? 'not-allowed' : 'pointer',
                            opacity: score === 0 ? 0.3 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          −
                        </button>
                        <button
                          onClick={() => dykmAwardPoint(player.id)}
                          style={{
                            width: 48,
                            height: 48,
                            background: MAROON,
                            border: 'none',
                            color: CREAM,
                            fontFamily: FONT_MONO,
                            fontSize: 24,
                            cursor: 'pointer',
                            fontWeight: 900,
                            boxShadow: `2px 2px 0 ${ROSE}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Asker's own score card (read-only) */}
          {(() => {
            const askerPlayer = players.find(p => p.id === ds.askerId);
            if (!askerPlayer) return null;
            const score = ds.scores?.[askerPlayer.id] ?? 0;
            return (
              <div style={{
                border: `1.5px dashed ${TEAL}`,
                background: PARCHMENT,
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <p style={{ fontFamily: isAr ? "'Changa', sans-serif" : FONT_MONO, fontSize: 14, color: TEAL, direction: isAr ? 'rtl' : 'ltr' }}>
                    {askerPlayer.name} <span style={{ fontSize: 10, letterSpacing: '0.2em' }}>[{isAr ? 'السائل' : 'ASKER'}]</span>
                  </p>
                  <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: TEAL }}>{score} / {ds.targetScore} pts</p>
                </div>
                {amHost && !amAsker && (
                  <button
                    onClick={() => handleSetAsker(askerPlayer.id)}
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 9,
                      color: TEAL,
                      border: `1px solid ${TEAL}`,
                      background: 'transparent',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      letterSpacing: '0.1em',
                    }}
                  >
                    KEEP
                  </button>
                )}
              </div>
            );
          })()}

          {/* Change asker (host only) */}
          {amHost && (
            <div>
              <p style={{ fontFamily: FONT_MONO, fontSize: 9, color: TEAL, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 6 }}>
                {isAr ? 'تغيير السائل' : 'CHANGE ASKER'}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {players.filter(p => p.id !== ds.askerId).map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleSetAsker(p.id)}
                    style={{
                      padding: '6px 14px',
                      background: PARCHMENT,
                      border: `1.5px solid ${TEAL}`,
                      color: TEAL,
                      fontFamily: isAr ? "'Changa', sans-serif" : FONT_MONO,
                      fontSize: 12,
                      cursor: 'pointer',
                      letterSpacing: '0.05em',
                      direction: isAr ? 'rtl' : 'ltr',
                    }}
                  >
                    {p.name} →
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Host controls */}
          {amHost && (
            <button
              onClick={dykmEndGame}
              style={{
                marginTop: 8,
                width: '100%',
                padding: '10px 0',
                background: 'transparent',
                color: '#b04040',
                border: '1.5px solid #b04040',
                fontFamily: FONT_MONO,
                fontSize: 12,
                letterSpacing: '0.2em',
                cursor: 'pointer',
              }}
            >
              {isAr ? 'إنهاء اللعبة' : 'END GAME'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── FINISHED ───────────────────────────────────────────────────────────────
  if (roomState.status === 'finished' && dykmState) {
    const ds: DykmState = dykmState;
    const sortedPlayers = (ds.players ?? roomState.players)
      .filter(p => p.id !== ds.askerId)
      .slice()
      .sort((a, b) => (ds.scores?.[b.id] ?? 0) - (ds.scores?.[a.id] ?? 0));

    return (
      <div style={{
        position: 'relative',
        minHeight: '100dvh',
        background: `linear-gradient(rgba(10,28,10,0.22), rgba(10,28,10,0.22)), url(${grassBg}) center/cover no-repeat`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        overflowY: 'auto',
      }}>
        <CrtScanlines />
        <PetalSwoop />

        {/* Winner announcement */}
        {ds.winnerName && (
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              color: TEAL,
              letterSpacing: '0.4em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              ▶ GAME OVER ◀
            </div>
            <div style={{
              fontFamily: isAr ? "'Changa', sans-serif" : FONT_MONO,
              fontSize: 'clamp(28px, 8vw, 52px)',
              fontWeight: 900,
              color: MAROON,
              lineHeight: 1.1,
              direction: isAr ? 'rtl' : 'ltr',
            }}>
              {ds.winnerName}
            </div>
            <div style={{
              fontFamily: FONT_MONO,
              fontSize: 13,
              color: ROSE,
              letterSpacing: '0.2em',
              marginTop: 6,
            }}>
              {isAr ? 'فاز!' : 'WINS!'}
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div style={{ width: '100%', maxWidth: 400, marginBottom: 32 }}>
          <p style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            color: TEAL,
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
            marginBottom: 10,
            textAlign: 'center',
          }}>FINAL SCORES</p>
          {sortedPlayers.map((p, i) => (
            <div key={p.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              background: i === 0 ? MAROON : (i % 2 === 0 ? PARCHMENT : CREAM),
              color: i === 0 ? CREAM : MAROON,
              border: `1.5px solid ${i === 0 ? MAROON : ROSE}`,
              marginBottom: 6,
            }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 700, minWidth: 20 }}>
                {i === 0 ? '★' : `${i + 1}.`}
              </span>
              <span style={{
                fontFamily: isAr ? "'Changa', sans-serif" : FONT_MONO,
                fontSize: 15,
                fontWeight: 700,
                flex: 1,
                direction: isAr ? 'rtl' : 'ltr',
              }}>
                {p.name}
              </span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 700 }}>
                {ds.scores?.[p.id] ?? 0} pts
              </span>
            </div>
          ))}
        </div>

        {/* Host controls */}
        {isHost && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 400 }}>
            <button
              onClick={dykmBackToLobby}
              style={{
                width: '100%',
                padding: '14px 0',
                background: MAROON,
                color: CREAM,
                border: 'none',
                fontFamily: isAr ? "'Changa', sans-serif" : FONT_MONO,
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: '0.1em',
                cursor: 'pointer',
                boxShadow: `3px 3px 0 ${ROSE}`,
              }}
            >
              {isAr ? 'العب مرة أخرى' : 'PLAY AGAIN'}
            </button>
            <button
              onClick={onGoHome}
              style={{
                width: '100%',
                padding: '10px 0',
                background: 'transparent',
                color: TEAL,
                border: `1.5px solid ${TEAL}`,
                fontFamily: FONT_MONO,
                fontSize: 12,
                letterSpacing: '0.2em',
                cursor: 'pointer',
              }}
            >
              {isAr ? '← الرئيسية' : '← HOME'}
            </button>
          </div>
        )}

        {!isHost && (
          <p style={{
            fontFamily: isAr ? "'Changa', sans-serif" : FONT_MONO,
            color: MAROON,
            fontSize: 14,
            opacity: 0.7,
          }}>
            {isAr ? 'انتظر المضيف…' : 'Waiting for host…'}
          </p>
        )}
      </div>
    );
  }

  // ── FALLBACK ───────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', minHeight: '100dvh', background: `linear-gradient(rgba(10,28,10,0.22), rgba(10,28,10,0.22)), url(${grassBg}) center/cover no-repeat`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: FONT_MONO, color: MAROON, fontSize: 14, letterSpacing: '0.1em' }}>
        Loading…
      </div>
    </div>
  );
}
