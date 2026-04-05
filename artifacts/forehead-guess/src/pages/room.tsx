import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useGetRoom, useListCategories } from '@workspace/api-client-react';
import { useGameSocket, RoomState, TurnState, GameResults } from '@/hooks/useGameSocket';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Copy, Check, Users } from 'lucide-react';

export default function Room() {
  const params = useParams<{ code: string }>();
  const code = params.code?.toUpperCase();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [playerId, setPlayerId] = useState<number | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    const storedId = sessionStorage.getItem(`fg_playerId_${code}`);
    const storedName = sessionStorage.getItem(`fg_playerName_${code}`);
    
    if (!storedId || !storedName) {
      toast({ title: 'Not in room', description: 'Please join the room first.' });
      setLocation('/');
      return;
    }
    
    setPlayerId(Number(storedId));
    setPlayerName(storedName);
  }, [code, setLocation, toast]);

  const { data: initialRoom, isLoading: isRoomLoading } = useGetRoom(code || '', {
    query: { enabled: !!code && !!playerId, queryKey: ['getRoom', code] }
  });

  const socket = useGameSocket(code || '', playerId, playerName);

  if (!code || !playerId || !playerName) {
    return null; // Redirecting
  }

  if (isRoomLoading && !socket.roomState) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  const roomStatus = socket.roomState?.status || initialRoom?.status || 'waiting';

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col relative">
      {socket.error && (
        <div className="bg-destructive text-destructive-foreground p-2 text-center font-bold">
          Connection Error: {socket.error}
        </div>
      )}
      
      {roomStatus === 'waiting' && (
        <LobbyView 
          roomCode={code} 
          playerId={playerId}
          roomState={socket.roomState} 
          initialRoom={initialRoom}
          setCategory={socket.setCategory}
          startGame={socket.startGame}
        />
      )}
      
      {roomStatus === 'playing' && (
        <GameView 
          playerId={playerId}
          roomState={socket.roomState}
          turnState={socket.turnState}
          onCorrect={socket.correct}
          onPass={socket.pass}
        />
      )}
      
      {roomStatus === 'finished' && (
        <ResultsView 
          playerId={playerId}
          roomState={socket.roomState}
          results={socket.gameResults}
          playAgain={socket.playAgain}
        />
      )}
    </div>
  );
}

function LobbyView({ roomCode, playerId, roomState, initialRoom, setCategory, startGame }: any) {
  const [copied, setCopied] = useState(false);
  const { data: categories } = useListCategories();
  
  const players = roomState?.players || initialRoom?.players || [];
  const isHost = players.find((p: any) => p.id === playerId)?.isHost;
  const currentCategoryId = roomState?.categoryId || initialRoom?.categoryId;
  
  const joinUrl = `${window.location.origin}/`; // We just send them to home to type the code
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}&bgcolor=ffffff`;

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="flex flex-col gap-6">
          <Card className="border-4 border-foreground shadow-[8px_8px_0_0_hsl(var(--foreground))] rounded-3xl overflow-hidden text-center p-8 bg-card">
            <h2 className="text-2xl font-bold mb-2">Room Code</h2>
            <div className="text-6xl md:text-8xl font-black tracking-widest text-primary mb-6">
              {roomCode}
            </div>
            
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-white rounded-xl shadow-inner border-2 border-muted">
                <img src={qrUrl} alt="QR Code to join" className="w-32 h-32 md:w-48 md:h-48 rounded" />
              </div>
            </div>

            <Button size="lg" variant="outline" className="w-full text-lg h-14 rounded-2xl border-2" onClick={handleCopy}>
              {copied ? <Check className="mr-2" /> : <Copy className="mr-2" />}
              {copied ? 'Copied!' : 'Copy Code'}
            </Button>
          </Card>
          
          {isHost && (
            <Card className="border-4 border-foreground shadow-[6px_6px_0_0_hsl(var(--foreground))] rounded-3xl bg-secondary/10">
              <CardHeader>
                <CardTitle>Game Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="font-bold text-lg block mb-2">Category</label>
                  <Select 
                    value={currentCategoryId ? String(currentCategoryId) : undefined} 
                    onValueChange={(val) => setCategory(Number(val))}
                  >
                    <SelectTrigger className="h-14 text-lg rounded-xl border-2 border-foreground bg-background">
                      <SelectValue placeholder="Select a category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)} className="text-lg">
                          {c.name} ({c.itemCount} items)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button 
                  size="lg" 
                  className="w-full h-16 text-xl rounded-2xl shadow-[0_6px_0_0_hsl(var(--primary-border))]"
                  disabled={players.length < 2 || !currentCategoryId}
                  onClick={startGame}
                >
                  Start Game
                </Button>
                {players.length < 2 && (
                  <p className="text-center text-muted-foreground font-medium mt-2">Waiting for more players...</p>
                )}
                {!currentCategoryId && players.length >= 2 && (
                  <p className="text-center text-destructive font-medium mt-2">Select a category to start</p>
                )}
              </CardContent>
            </Card>
          )}
          
          {!isHost && (
            <Card className="border-4 border-foreground shadow-[6px_6px_0_0_hsl(var(--foreground))] rounded-3xl bg-secondary/10 flex items-center justify-center p-8">
              <div className="text-center">
                <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary mb-4" />
                <h3 className="text-2xl font-bold">Waiting for host...</h3>
                <p className="text-muted-foreground">The game will start soon</p>
              </div>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card className="border-4 border-foreground shadow-[8px_8px_0_0_hsl(var(--foreground))] rounded-3xl flex-1">
            <CardHeader className="bg-muted border-b-4 border-foreground rounded-t-[1.3rem] flex flex-row items-center justify-between py-4">
              <CardTitle className="text-2xl flex items-center gap-2">
                <Users className="w-6 h-6 text-primary" /> 
                Players
              </CardTitle>
              <div className="bg-background px-4 py-1 rounded-full border-2 border-foreground font-bold">
                {players.length}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y-4 divide-foreground/10">
                {players.map((p: any) => (
                  <li key={p.id} className="p-4 md:p-6 flex items-center justify-between text-xl font-bold">
                    <div className="flex items-center gap-3">
                      <span className={p.id === playerId ? 'text-primary' : ''}>
                        {p.name} {p.id === playerId && '(You)'}
                      </span>
                    </div>
                    {p.isHost && (
                      <span className="bg-secondary text-secondary-foreground text-sm py-1 px-3 rounded-full border-2 border-foreground">
                        Host
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function GameView({ playerId, roomState, turnState, onCorrect, onPass }: any) {
  if (!turnState) {
    return <div className="flex-1 flex items-center justify-center font-bold text-2xl">Loading round...</div>;
  }

  const isMyTurn = turnState.currentPlayerId === playerId;
  const word = turnState.assignment?.itemText || '???';
  const secondsLeft = turnState.secondsLeft || 0;

  return (
    <div className="flex-1 flex flex-col bg-background relative overflow-hidden">
      {/* Timer Bar */}
      <div className="h-4 w-full bg-muted absolute top-0 left-0 z-10">
        <div 
          className="h-full bg-primary transition-all duration-1000 ease-linear" 
          style={{ width: `${(secondsLeft / (roomState?.turnDuration || 60)) * 100}%` }}
        />
      </div>

      {isMyTurn ? (
        <div className="flex-1 flex flex-col p-6 items-center justify-center relative">
          <div className="absolute top-10 text-center animate-pulse">
            <p className="text-lg md:text-xl font-bold text-muted-foreground uppercase tracking-widest bg-muted/50 px-6 py-2 rounded-full">
              Hold phone to forehead
            </p>
          </div>
          
          <div className="text-[120px] md:text-[200px] font-black text-primary leading-none tabular-nums drop-shadow-lg">
            {secondsLeft}
          </div>
          
          <div className="absolute bottom-6 left-6 right-6 flex gap-4">
            <Button 
              size="lg" 
              variant="destructive" 
              className="flex-1 h-32 text-3xl md:text-4xl font-black rounded-[2rem] border-4 border-foreground shadow-[8px_8px_0_0_hsl(var(--foreground))]"
              onClick={onPass}
            >
              PASS
            </Button>
            <Button 
              size="lg" 
              className="flex-1 h-32 text-3xl md:text-4xl font-black bg-[#4ade80] hover:bg-[#22c55e] text-black rounded-[2rem] border-4 border-foreground shadow-[8px_8px_0_0_hsl(var(--foreground))]"
              onClick={onCorrect}
            >
              CORRECT!
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col p-6 items-center justify-center bg-secondary/20">
          <div className="text-center mb-8">
            <p className="text-2xl font-bold text-muted-foreground">
              <span className="text-foreground underline decoration-wavy decoration-primary decoration-4">
                {turnState.currentPlayerName}'s
              </span> turn
            </p>
          </div>
          
          <div className="bg-card border-8 border-foreground p-8 md:p-16 rounded-[3rem] shadow-[12px_12px_0_0_hsl(var(--foreground))] w-full max-w-4xl text-center transform -rotate-2">
            {turnState.assignment?.imageUrl && (
              <img src={turnState.assignment.imageUrl} alt="assignment" className="max-h-64 mx-auto mb-8 rounded-xl border-4 border-foreground" />
            )}
            <h1 className="text-6xl md:text-8xl lg:text-[120px] font-black leading-tight tracking-tight uppercase break-words">
              {word}
            </h1>
          </div>
          
          <div className="absolute bottom-10 right-10">
            <div className="w-24 h-24 rounded-full border-4 border-foreground bg-primary flex items-center justify-center text-4xl font-black text-white shadow-[6px_6px_0_0_hsl(var(--foreground))]">
              {secondsLeft}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultsView({ playerId, roomState, results, playAgain }: any) {
  if (!results) return null;
  
  const isHost = roomState?.players?.find((p: any) => p.id === playerId)?.isHost;
  const sortedPlayers = [...results.players].sort((a, b) => b.score - a.score);

  return (
    <div className="flex-1 p-6 flex flex-col items-center justify-center bg-background relative">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        {/* Confetti-like background dots */}
        {[...Array(20)].map((_, i) => (
          <div key={i} className="absolute rounded-full" style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            width: `${Math.random() * 20 + 10}px`,
            height: `${Math.random() * 20 + 10}px`,
            backgroundColor: ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))'][Math.floor(Math.random() * 3)],
            opacity: 0.3
          }} />
        ))}
      </div>

      <div className="z-10 w-full max-w-3xl">
        <h1 className="text-5xl md:text-7xl font-black text-center mb-10 transform -rotate-2">
          Game <span className="text-primary">Over!</span>
        </h1>
        
        <Card className="border-4 border-foreground shadow-[12px_12px_0_0_hsl(var(--foreground))] rounded-[2rem] overflow-hidden mb-8">
          <div className="bg-foreground text-background py-4 px-6">
            <h2 className="text-2xl font-bold">Final Scores</h2>
          </div>
          <CardContent className="p-0">
            <ul className="divide-y-4 divide-foreground/10">
              {sortedPlayers.map((p: any, idx: number) => (
                <li key={p.id} className={`p-6 flex items-center justify-between ${idx === 0 ? 'bg-secondary/20' : ''}`}>
                  <div className="flex items-center gap-4">
                    <span className="text-3xl font-black text-muted-foreground w-8">{idx + 1}</span>
                    <span className={`text-2xl font-bold ${p.id === playerId ? 'text-primary' : ''}`}>
                      {p.name} {p.id === playerId && '(You)'}
                    </span>
                    {idx === 0 && <span className="text-2xl">👑</span>}
                  </div>
                  <div className="text-4xl font-black">
                    {p.score} <span className="text-xl text-muted-foreground ml-1">pts</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        
        {isHost ? (
          <Button 
            size="lg" 
            className="w-full h-20 text-3xl font-black rounded-2xl shadow-[0_8px_0_0_hsl(var(--primary-border))]"
            onClick={playAgain}
          >
            Play Again
          </Button>
        ) : (
          <div className="text-center p-6 bg-muted rounded-2xl border-4 border-foreground font-bold text-xl">
            Waiting for host to start a new game...
          </div>
        )}
      </div>
    </div>
  );
}
