import { useState, useRef, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useAdminVerify,
  useAdminListCategories,
  useAdminUpdateCategory,
  useAdminDeleteCategory,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Upload, FileSpreadsheet, CheckCircle, Trash2, AlertCircle } from 'lucide-react';

const loginSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

export default function Admin() {
  const { toast } = useToast();
  const [password, setPassword] = useState<string | null>(sessionStorage.getItem('fg_admin_pw'));
  const verifyMutation = useAdminVerify();
  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { password: '' },
  });

  const onLogin = (values: z.infer<typeof loginSchema>) => {
    verifyMutation.mutate({ data: { password: values.password } }, {
      onSuccess: (res) => {
        if (res.valid) {
          sessionStorage.setItem('fg_admin_pw', values.password);
          setPassword(values.password);
        } else {
          toast({ title: 'Invalid password', variant: 'destructive' });
        }
      },
      onError: () => toast({ title: 'Error verifying password', variant: 'destructive' })
    });
  };

  if (!password) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-sm">
          <CardHeader><CardTitle>Admin Login</CardTitle></CardHeader>
          <CardContent>
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" data-testid="input-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" data-testid="button-login" disabled={verifyMutation.isPending}>
                  {verifyMutation.isPending ? 'Checking...' : 'Login'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <AdminDashboard password={password} onLogout={() => {
    sessionStorage.removeItem('fg_admin_pw');
    setPassword(null);
  }} />;
}

interface UploadResult {
  categories: Array<{ name: string; itemCount: number; created: boolean }>;
  totalCategories: number;
  errors: string[];
}

interface CharUploadResult {
  imported: number;
  skipped: number;
  errors: string[];
}

interface CharEntry {
  id: number;
  answer: string;
  hints: string[];
  lang: string;
}

interface CharadeEntry {
  id: number;
  answer: string;
  lang: string;
}

function UploadButtonPurple({
  label,
  sublabel,
  uploading,
  uploadResult,
  uploadError,
  fileRef,
  accept,
  onFile,
}: {
  label: string;
  sublabel: string;
  uploading: boolean;
  uploadResult: CharUploadResult | null;
  uploadError: string | null;
  fileRef: React.RefObject<HTMLInputElement | null>;
  accept: string;
  onFile: (f: File) => void;
}) {
  return (
    <div className="rounded-2xl border-2 p-5 space-y-3 border-[#a855f7]/40 bg-[#a855f7]/5">
      <div>
        <p className="font-bold text-base text-[#a855f7]">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      <Button
        size="sm"
        className="gap-2 w-full bg-[#a855f7] hover:bg-[#9333ea] text-white"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="w-4 h-4" />
        {uploading ? 'Uploading…' : 'Choose File'}
      </Button>
      {uploadError && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {uploadError}
        </div>
      )}
      {uploadResult && (
        <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-sm">
          <div className="flex items-center gap-2 font-bold text-green-800">
            <CheckCircle className="w-4 h-4" />
            {uploadResult.imported} words imported
            {uploadResult.skipped > 0 && (
              <span className="text-xs font-normal text-green-600">({uploadResult.skipped} skipped)</span>
            )}
          </div>
          <p className="text-xs text-green-700 mt-1">Previous list replaced.</p>
        </div>
      )}
    </div>
  );
}

function UploadButton({
  label,
  sublabel,
  color,
  uploading,
  uploadResult,
  uploadError,
  fileRef,
  accept,
  onFile,
  testId,
}: {
  label: string;
  sublabel: string;
  color: 'pink' | 'cyan';
  uploading: boolean;
  uploadResult: UploadResult | CharUploadResult | null;
  uploadError: string | null;
  fileRef: React.RefObject<HTMLInputElement | null>;
  accept: string;
  onFile: (f: File) => void;
  testId?: string;
}) {
  const isForeheadResult = uploadResult && 'totalCategories' in uploadResult;
  const isCharResult = uploadResult && 'imported' in uploadResult;

  return (
    <div className={`rounded-2xl border-2 p-5 space-y-3 ${
      color === 'pink'
        ? 'border-[#ff4fa3]/40 bg-[#ff4fa3]/5'
        : 'border-[#39d5ff]/40 bg-[#39d5ff]/5'
    }`}>
      <div>
        <p className={`font-bold text-base ${color === 'pink' ? 'text-[#ff4fa3]' : 'text-[#39d5ff]'}`}>{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="hidden"
        data-testid={testId}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      <Button
        size="sm"
        className={`gap-2 w-full ${
          color === 'pink'
            ? 'bg-[#ff4fa3] hover:bg-[#e03d91] text-white'
            : 'bg-[#39d5ff] hover:bg-[#28b8e0] text-black'
        }`}
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="w-4 h-4" />
        {uploading ? 'Uploading…' : 'Choose File'}
      </Button>

      {uploadError && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {uploadError}
        </div>
      )}
      {isForeheadResult && (
        <div className="p-3 rounded-xl bg-green-50 border border-green-200 space-y-1">
          <div className="flex items-center gap-2 font-bold text-green-800 text-sm">
            <CheckCircle className="w-4 h-4" />
            {(uploadResult as UploadResult).totalCategories} categories updated
          </div>
          {(uploadResult as UploadResult).categories.map(cat => (
            <div key={cat.name} className="text-xs text-green-700 flex items-center gap-1.5 pl-1">
              <span className="font-medium">{cat.name}</span>
              <span className="text-green-400">·</span>
              <span>{cat.itemCount} words</span>
              {cat.created && <span className="text-xs bg-green-200 text-green-800 px-1.5 py-0.5 rounded font-medium">NEW</span>}
            </div>
          ))}
        </div>
      )}
      {isCharResult && (
        <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-sm">
          <div className="flex items-center gap-2 font-bold text-green-800">
            <CheckCircle className="w-4 h-4" />
            {(uploadResult as CharUploadResult).imported} characters imported
            {(uploadResult as CharUploadResult).skipped > 0 && (
              <span className="text-xs font-normal text-green-600">({(uploadResult as CharUploadResult).skipped} skipped)</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminDashboard({ password, onLogout }: { password: string; onLogout: () => void }) {
  const { toast } = useToast();

  // Forehead upload refs + state
  const fhEnRef = useRef<HTMLInputElement>(null);
  const fhArRef = useRef<HTMLInputElement>(null);
  const [fhEnUploading, setFhEnUploading] = useState(false);
  const [fhArUploading, setFhArUploading] = useState(false);
  const [fhEnResult, setFhEnResult] = useState<UploadResult | null>(null);
  const [fhArResult, setFhArResult] = useState<UploadResult | null>(null);
  const [fhEnError, setFhEnError] = useState<string | null>(null);
  const [fhArError, setFhArError] = useState<string | null>(null);

  // Character upload refs + state
  const charEnRef = useRef<HTMLInputElement>(null);
  const charArRef = useRef<HTMLInputElement>(null);
  const [charEnUploading, setCharEnUploading] = useState(false);
  const [charArUploading, setCharArUploading] = useState(false);
  const [charEnResult, setCharEnResult] = useState<CharUploadResult | null>(null);
  const [charArResult, setCharArResult] = useState<CharUploadResult | null>(null);
  const [charEnError, setCharEnError] = useState<string | null>(null);
  const [charArError, setCharArError] = useState<string | null>(null);

  // Charades upload refs + state
  const crdEnRef = useRef<HTMLInputElement>(null);
  const crdArRef = useRef<HTMLInputElement>(null);
  const [crdEnUploading, setCrdEnUploading] = useState(false);
  const [crdArUploading, setCrdArUploading] = useState(false);
  const [crdEnResult, setCrdEnResult] = useState<CharUploadResult | null>(null);
  const [crdArResult, setCrdArResult] = useState<CharUploadResult | null>(null);
  const [crdEnError, setCrdEnError] = useState<string | null>(null);
  const [crdArError, setCrdArError] = useState<string | null>(null);

  // Character list
  const [characters, setCharacters] = useState<CharEntry[]>([]);
  const [charsLoading, setCharsLoading] = useState(false);

  // Charades list
  const [charades, setCharades] = useState<CharadeEntry[]>([]);
  const [crdLoading, setCrdLoading] = useState(false);

  const { data: categories, isLoading: catsLoading, refetch } = useAdminListCategories({
    request: { headers: { 'x-admin-password': password } }
  });
  const updateCategory = useAdminUpdateCategory();
  const deleteCategory = useAdminDeleteCategory();

  // ── Forehead upload ──────────────────────────────────────────────
  const handleForeheadUpload = async (file: File, lang: 'en' | 'ar') => {
    const setUploading = lang === 'en' ? setFhEnUploading : setFhArUploading;
    const setResult   = lang === 'en' ? setFhEnResult   : setFhArResult;
    const setError    = lang === 'en' ? setFhEnError    : setFhArError;
    const ref         = lang === 'en' ? fhEnRef         : fhArRef;

    setUploading(true); setResult(null); setError(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`/api/admin/upload-master?lang=${lang}`, {
        method: 'POST',
        headers: { 'x-admin-password': password },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Upload failed');
      } else {
        setResult(data as UploadResult);
        toast({ title: `${lang === 'en' ? 'English' : 'Arabic'} categories uploaded!`, description: `${data.totalCategories} categories updated.` });
        refetch();
      }
    } catch {
      setError('Network error — could not upload file.');
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = '';
    }
  };

  // ── Character upload ─────────────────────────────────────────────
  const handleCharUpload = async (file: File, lang: 'en' | 'ar') => {
    const setUploading = lang === 'en' ? setCharEnUploading : setCharArUploading;
    const setResult   = lang === 'en' ? setCharEnResult   : setCharArResult;
    const setError    = lang === 'en' ? setCharEnError    : setCharArError;
    const ref         = lang === 'en' ? charEnRef         : charArRef;

    setUploading(true); setResult(null); setError(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`/api/admin/upload-characters?lang=${lang}`, {
        method: 'POST',
        headers: { 'x-admin-password': password },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Upload failed');
      } else {
        setResult(data as CharUploadResult);
        toast({ title: `${lang === 'en' ? 'English' : 'Arabic'} characters uploaded!`, description: `${data.imported} characters added.` });
        fetchCharacters();
      }
    } catch {
      setError('Network error — could not upload file.');
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = '';
    }
  };

  // ── Character list ───────────────────────────────────────────────
  const fetchCharacters = useCallback(async () => {
    setCharsLoading(true);
    try {
      const res = await fetch('/api/admin/characters', { headers: { 'x-admin-password': password } });
      if (res.ok) setCharacters(await res.json());
    } catch { /* ignore */ }
    finally { setCharsLoading(false); }
  }, [password]);

  useEffect(() => { fetchCharacters(); }, [fetchCharacters]);

  // ── Charades upload ──────────────────────────────────────────────
  const handleCharadesUpload = async (file: File, lang: 'en' | 'ar') => {
    const setUploading = lang === 'en' ? setCrdEnUploading : setCrdArUploading;
    const setResult   = lang === 'en' ? setCrdEnResult   : setCrdArResult;
    const setError    = lang === 'en' ? setCrdEnError    : setCrdArError;
    const ref         = lang === 'en' ? crdEnRef         : crdArRef;

    setUploading(true); setResult(null); setError(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`/api/admin/upload-charades?lang=${lang}`, {
        method: 'POST',
        headers: { 'x-admin-password': password },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Upload failed');
      } else {
        setResult(data as CharUploadResult);
        toast({ title: `${lang === 'en' ? 'English' : 'Arabic'} charades uploaded!`, description: `${data.imported} words added.` });
        fetchCharades();
      }
    } catch {
      setError('Network error — could not upload file.');
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = '';
    }
  };

  // ── Charades list ────────────────────────────────────────────────
  const fetchCharades = useCallback(async () => {
    setCrdLoading(true);
    try {
      const res = await fetch('/api/admin/charades', { headers: { 'x-admin-password': password } });
      if (res.ok) setCharades(await res.json());
    } catch { /* ignore */ }
    finally { setCrdLoading(false); }
  }, [password]);

  useEffect(() => { fetchCharades(); }, [fetchCharades]);

  const handleDeleteCharade = async (id: number, answer: string) => {
    if (!confirm(`Delete charade "${answer}"?`)) return;
    try {
      const res = await fetch(`/api/admin/charades/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': password }
      });
      if (res.ok) { toast({ title: `"${answer}" deleted` }); fetchCharades(); }
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' });
    }
  };

  const handleDeleteCharacter = async (id: number, answer: string) => {
    if (!confirm(`Delete character "${answer}"?`)) return;
    try {
      const res = await fetch(`/api/admin/characters/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': password }
      });
      if (res.ok) { toast({ title: `"${answer}" deleted` }); fetchCharacters(); }
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' });
    }
  };

  // ── Category helpers ─────────────────────────────────────────────
  const toggleCategory = (id: number, enabled: boolean) => {
    updateCategory.mutate({ id, data: { enabled } }, {
      request: { headers: { 'x-admin-password': password } },
      onSuccess: () => refetch(),
      onError: () => toast({ title: 'Failed to update category', variant: 'destructive' })
    });
  };

  const handleDeleteCategory = (id: number, name: string) => {
    if (!confirm(`Delete category "${name}" and all its words?`)) return;
    deleteCategory.mutate({ id }, {
      request: { headers: { 'x-admin-password': password } },
      onSuccess: () => { toast({ title: `"${name}" deleted` }); refetch(); },
      onError: () => toast({ title: 'Failed to delete', variant: 'destructive' })
    });
  };

  const enCategories = categories?.filter(c => c.type === 'en') ?? [];
  const arCategories = categories?.filter(c => c.type === 'ar') ?? [];
  const enChars = characters.filter(c => c.lang === 'en');
  const arChars = characters.filter(c => c.lang === 'ar');
  const enCharades = charades.filter(c => c.lang === 'en');
  const arCharades = charades.filter(c => c.lang === 'ar');

  return (
    <div className="min-h-[100dvh] p-6 bg-muted/10 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black">Admin Dashboard</h1>
        <Button variant="outline" onClick={onLogout} data-testid="button-logout">Logout</Button>
      </div>

      <div className="space-y-10">

        {/* ══════════════════════════════════════════════════════
            SECTION 1 — FOREHEAD GAME UPLOADS
        ══════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🤚</span>
            <div>
              <h2 className="text-xl font-black">Forehead Game</h2>
              <p className="text-sm text-muted-foreground">Upload word lists. Each column = one category. Row 1 = category name. Rows below = words.</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <UploadButton
              label="🇬🇧 English Categories"
              sublabel="CSV or Excel — words in English"
              color="pink"
              uploading={fhEnUploading}
              uploadResult={fhEnResult}
              uploadError={fhEnError}
              fileRef={fhEnRef}
              accept=".csv,.xlsx,.xls"
              onFile={f => handleForeheadUpload(f, 'en')}
              testId="input-master-file-en"
            />
            <UploadButton
              label="🇸🇦 Arabic Categories — فئات عربية"
              sublabel="CSV or Excel — words in Arabic"
              color="cyan"
              uploading={fhArUploading}
              uploadResult={fhArResult}
              uploadError={fhArError}
              fileRef={fhArRef}
              accept=".csv,.xlsx,.xls"
              onFile={f => handleForeheadUpload(f, 'ar')}
              testId="input-master-file-ar"
            />
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            SECTION 2 — GUESS THE CHARACTER UPLOADS
        ══════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🕵️</span>
            <div>
              <h2 className="text-xl font-black">Guess the Character</h2>
              <p className="text-sm text-muted-foreground">Upload character pools. Column A = answer (character name). Columns B–K = up to 10 hints.</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <UploadButton
              label="🇬🇧 English Characters"
              sublabel="CSV — answer in col A, hints in cols B–K"
              color="pink"
              uploading={charEnUploading}
              uploadResult={charEnResult}
              uploadError={charEnError}
              fileRef={charEnRef}
              accept=".csv"
              onFile={f => handleCharUpload(f, 'en')}
              testId="input-char-file-en"
            />
            <UploadButton
              label="🇸🇦 Arabic Characters — شخصيات عربية"
              sublabel="CSV — الجواب في العمود A، تلميحات في B–K"
              color="cyan"
              uploading={charArUploading}
              uploadResult={charArResult}
              uploadError={charArError}
              fileRef={charArRef}
              accept=".csv"
              onFile={f => handleCharUpload(f, 'ar')}
              testId="input-char-file-ar"
            />
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            SECTION 3 — FOREHEAD CATEGORIES LIST
        ══════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">📋</span>
            <div>
              <h2 className="text-xl font-black">Uploaded Forehead Categories</h2>
              <p className="text-sm text-muted-foreground">Toggle categories on/off or delete them.</p>
            </div>
          </div>

          {catsLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (enCategories.length === 0 && arCategories.length === 0) ? (
            <p className="text-muted-foreground text-sm">No categories yet. Upload a file above.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {/* English */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#ff4fa3] mb-2">🇬🇧 English ({enCategories.length})</p>
                {enCategories.length === 0 ? (
                  <p className="text-muted-foreground text-sm">None uploaded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {enCategories.map(cat => (
                      <div key={cat.id} data-testid={`card-category-${cat.id}`}
                        className="flex items-center justify-between p-3 border rounded-xl bg-card">
                        <div>
                          <p className="font-semibold">{cat.name}</p>
                          <p className="text-xs text-muted-foreground">{cat.itemCount} words</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Switch
                            data-testid={`switch-category-${cat.id}`}
                            checked={cat.enabled}
                            onCheckedChange={v => toggleCategory(cat.id, v)}
                          />
                          <Button variant="ghost" size="icon"
                            data-testid={`button-delete-category-${cat.id}`}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteCategory(cat.id, cat.name)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Arabic */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#39d5ff] mb-2">🇸🇦 Arabic ({arCategories.length})</p>
                {arCategories.length === 0 ? (
                  <p className="text-muted-foreground text-sm">None uploaded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {arCategories.map(cat => (
                      <div key={cat.id} data-testid={`card-category-${cat.id}`}
                        className="flex items-center justify-between p-3 border rounded-xl bg-card">
                        <div>
                          <p className="font-semibold" dir="rtl">{cat.name}</p>
                          <p className="text-xs text-muted-foreground">{cat.itemCount} words</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Switch
                            data-testid={`switch-category-${cat.id}`}
                            checked={cat.enabled}
                            onCheckedChange={v => toggleCategory(cat.id, v)}
                          />
                          <Button variant="ghost" size="icon"
                            data-testid={`button-delete-category-${cat.id}`}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteCategory(cat.id, cat.name)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════
            SECTION 4 — GUESS THE CHARACTER LIST
        ══════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🗃️</span>
            <div>
              <h2 className="text-xl font-black">Uploaded Characters</h2>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                Showing all characters in the pool.
                <button onClick={fetchCharacters} className="text-[#39d5ff] text-xs hover:underline">Refresh</button>
              </p>
            </div>
          </div>

          {charsLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (enChars.length === 0 && arChars.length === 0) ? (
            <p className="text-muted-foreground text-sm">No characters yet. Upload a CSV above.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {/* English */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#ff4fa3] mb-2">🇬🇧 English ({enChars.length})</p>
                {enChars.length === 0 ? (
                  <p className="text-muted-foreground text-sm">None uploaded yet.</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {enChars.map(char => (
                      <div key={char.id}
                        className="flex items-center justify-between p-3 border rounded-xl bg-card">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{char.answer}</p>
                          <p className="text-xs text-muted-foreground">{char.hints.length} hint{char.hints.length !== 1 ? 's' : ''}</p>
                        </div>
                        <Button variant="ghost" size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0 ml-2"
                          onClick={() => handleDeleteCharacter(char.id, char.answer)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Arabic */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#39d5ff] mb-2">🇸🇦 Arabic ({arChars.length})</p>
                {arChars.length === 0 ? (
                  <p className="text-muted-foreground text-sm">None uploaded yet.</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {arChars.map(char => (
                      <div key={char.id}
                        className="flex items-center justify-between p-3 border rounded-xl bg-card">
                        <div className="min-w-0">
                          <p className="font-semibold truncate" dir="rtl">{char.answer}</p>
                          <p className="text-xs text-muted-foreground">{char.hints.length} hint{char.hints.length !== 1 ? 's' : ''}</p>
                        </div>
                        <Button variant="ghost" size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0 ml-2"
                          onClick={() => handleDeleteCharacter(char.id, char.answer)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════
            SECTION 5 — CHARADES UPLOADS & LIST
        ══════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🎭</span>
            <div>
              <h2 className="text-xl font-black">Charades</h2>
              <p className="text-sm text-muted-foreground">Upload a single-column list of charade answers. One word/phrase per row.</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <UploadButtonPurple
              label="🇬🇧 English Charades"
              sublabel="CSV or Excel — one answer per row"
              uploading={crdEnUploading}
              uploadResult={crdEnResult}
              uploadError={crdEnError}
              fileRef={crdEnRef}
              accept=".csv,.xlsx,.xls"
              onFile={f => handleCharadesUpload(f, 'en')}
            />
            <UploadButtonPurple
              label="🇸🇦 Arabic Charades — شاردز عربي"
              sublabel="CSV or Excel — كلمة أو عبارة في كل سطر"
              uploading={crdArUploading}
              uploadResult={crdArResult}
              uploadError={crdArError}
              fileRef={crdArRef}
              accept=".csv,.xlsx,.xls"
              onFile={f => handleCharadesUpload(f, 'ar')}
            />
          </div>

          {crdLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (enCharades.length === 0 && arCharades.length === 0) ? (
            <p className="text-muted-foreground text-sm">No charades yet. Upload a CSV above.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#a855f7] mb-2">
                  🇬🇧 English ({enCharades.length})
                </p>
                <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                  {enCharades.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-2.5 border rounded-xl bg-card">
                      <p className="font-medium text-sm truncate">{c.answer}</p>
                      <Button
                        variant="ghost" size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0 ml-2 h-7 w-7"
                        onClick={() => handleDeleteCharade(c.id, c.answer)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#a855f7] mb-2">
                  🇸🇦 Arabic ({arCharades.length})
                </p>
                <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                  {arCharades.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-2.5 border rounded-xl bg-card">
                      <p className="font-medium text-sm truncate" dir="rtl">{c.answer}</p>
                      <Button
                        variant="ghost" size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0 ml-2 h-7 w-7"
                        onClick={() => handleDeleteCharade(c.id, c.answer)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
