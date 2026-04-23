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
          <CardHeader>
            <CardTitle>Admin Login</CardTitle>
          </CardHeader>
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

interface CharacterUploadResult {
  imported: number;
  skipped: number;
  errors: string[];
}

function AdminDashboard({ password, onLogout }: { password: string; onLogout: () => void }) {
  const { toast } = useToast();
  const enFileRef = useRef<HTMLInputElement>(null);
  const arFileRef = useRef<HTMLInputElement>(null);
  const charFileRef = useRef<HTMLInputElement>(null);
  const [uploadingEn, setUploadingEn] = useState(false);
  const [uploadingAr, setUploadingAr] = useState(false);
  const [uploadingChar, setUploadingChar] = useState(false);
  const [uploadResultEn, setUploadResultEn] = useState<UploadResult | null>(null);
  const [uploadResultAr, setUploadResultAr] = useState<UploadResult | null>(null);
  const [uploadResultChar, setUploadResultChar] = useState<CharacterUploadResult | null>(null);
  const [uploadErrorEn, setUploadErrorEn] = useState<string | null>(null);
  const [uploadErrorAr, setUploadErrorAr] = useState<string | null>(null);
  const [uploadErrorChar, setUploadErrorChar] = useState<string | null>(null);
  const [charLang, setCharLang] = useState<'en' | 'ar'>('en');
  const [characters, setCharacters] = useState<Array<{id: number; answer: string; hints: string[]; lang: string}>>([]);
  const [charsLoading, setCharsLoading] = useState(false);

  const { data: categories, isLoading, refetch } = useAdminListCategories({
    request: { headers: { 'x-admin-password': password } }
  });
  const updateCategory = useAdminUpdateCategory();
  const deleteCategory = useAdminDeleteCategory();

  const handleMasterUpload = async (file: File, lang: 'en' | 'ar') => {
    const setUploading = lang === 'en' ? setUploadingEn : setUploadingAr;
    const setResult = lang === 'en' ? setUploadResultEn : setUploadResultAr;
    const setError = lang === 'en' ? setUploadErrorEn : setUploadErrorAr;
    const fileRef = lang === 'en' ? enFileRef : arFileRef;

    setUploading(true);
    setResult(null);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/admin/upload-master?lang=${lang}`, {
        method: 'POST',
        headers: { 'x-admin-password': password },
        body: formData,
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
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const fetchCharacters = useCallback(async () => {
    setCharsLoading(true);
    try {
      const res = await fetch('/api/admin/characters', {
        headers: { 'x-admin-password': password }
      });
      if (res.ok) {
        const data = await res.json();
        setCharacters(data);
      }
    } catch {
      // ignore
    } finally {
      setCharsLoading(false);
    }
  }, [password]);

  useEffect(() => { fetchCharacters(); }, [fetchCharacters]);

  const handleCharacterUpload = async (file: File, lang: 'en' | 'ar') => {
    setUploadingChar(true);
    setUploadResultChar(null);
    setUploadErrorChar(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`/api/admin/upload-characters?lang=${lang}`, {
        method: 'POST',
        headers: { 'x-admin-password': password },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadErrorChar(data.error || 'Upload failed');
      } else {
        setUploadResultChar(data as CharacterUploadResult);
        toast({ title: `${lang === 'en' ? 'English' : 'Arabic'} characters uploaded!`, description: `${data.imported} characters added.` });
        fetchCharacters();
      }
    } catch {
      setUploadErrorChar('Network error — could not upload file.');
    } finally {
      setUploadingChar(false);
      if (charFileRef.current) charFileRef.current.value = '';
    }
  };

  const handleDeleteCharacter = async (id: number, answer: string) => {
    if (!confirm(`Delete character "${answer}" and all its hints?`)) return;
    try {
      const res = await fetch(`/api/admin/characters/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': password }
      });
      if (res.ok) {
        toast({ title: `"${answer}" deleted` });
        fetchCharacters();
      }
    } catch {
      toast({ title: 'Failed to delete character', variant: 'destructive' });
    }
  };

  const toggleCategory = (id: number, enabled: boolean) => {
    updateCategory.mutate(
      { id, data: { enabled } },
      {
        request: { headers: { 'x-admin-password': password } },
        onSuccess: () => refetch(),
        onError: () => toast({ title: 'Failed to update category', variant: 'destructive' })
      }
    );
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Delete category "${name}" and all its words?`)) return;
    deleteCategory.mutate(
      { id },
      {
        request: { headers: { 'x-admin-password': password } },
        onSuccess: () => { toast({ title: `"${name}" deleted` }); refetch(); },
        onError: () => toast({ title: 'Failed to delete', variant: 'destructive' })
      }
    );
  };

  return (
    <div className="min-h-[100dvh] p-6 bg-muted/10 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black">Admin Dashboard</h1>
        <Button variant="outline" onClick={onLogout} data-testid="button-logout">Logout</Button>
      </div>

      <div className="space-y-6">
        {/* ── Format hint ── */}
        <Card className="border bg-muted/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="w-4 h-4" />
              File Format
            </CardTitle>
            <CardDescription>
              Each <strong>column</strong> = one category. Row 1 = category name. Rows below = words.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl bg-card border p-4 font-mono text-sm overflow-x-auto">
              <div className="grid grid-cols-3 gap-4 text-center min-w-[300px]">
                <div className="font-bold text-primary border-b pb-1">Sports</div>
                <div className="font-bold text-primary border-b pb-1">Movies</div>
                <div className="font-bold text-primary border-b pb-1">Animals</div>
                <div className="text-muted-foreground">Soccer</div>
                <div className="text-muted-foreground">Titanic</div>
                <div className="text-muted-foreground">Elephant</div>
                <div className="text-muted-foreground">Basketball</div>
                <div className="text-muted-foreground">Avatar</div>
                <div className="text-muted-foreground">Tiger</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          {/* ── English Upload ── */}
          {(['en', 'ar'] as const).map((lang) => {
            const isEn = lang === 'en';
            const uploading = isEn ? uploadingEn : uploadingAr;
            const uploadResult = isEn ? uploadResultEn : uploadResultAr;
            const uploadError = isEn ? uploadErrorEn : uploadErrorAr;
            const fileRef = isEn ? enFileRef : arFileRef;

            return (
              <Card key={lang} className={`border-2 ${isEn ? 'border-pink-400/40 bg-pink-50/30' : 'border-cyan-400/40 bg-cyan-50/30'}`}>
                <CardHeader>
                  <CardTitle className={`flex items-center gap-2 ${isEn ? 'text-pink-700' : 'text-cyan-700'}`}>
                    <FileSpreadsheet className="w-5 h-5" />
                    {isEn ? 'English Categories' : 'Arabic Categories — فئات عربية'}
                  </CardTitle>
                  <CardDescription>
                    {isEn
                      ? 'Upload an English-language word list. Players in English mode will see these categories.'
                      : 'Upload an Arabic-language word list. Players in Arabic mode will see these categories.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      data-testid={`input-master-file-${lang}`}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleMasterUpload(file, lang);
                      }}
                    />
                    <Button
                      size="lg"
                      className={`gap-2 ${isEn ? 'bg-pink-600 hover:bg-pink-700' : 'bg-cyan-600 hover:bg-cyan-700'} text-white`}
                      disabled={uploading}
                      data-testid={`button-upload-master-${lang}`}
                      onClick={() => fileRef.current?.click()}
                    >
                      <Upload className="w-4 h-4" />
                      {uploading ? 'Uploading...' : 'Choose File'}
                    </Button>
                    <span className="text-sm text-muted-foreground">CSV or Excel (.xlsx)</span>
                  </div>

                  {uploadError && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      {uploadError}
                    </div>
                  )}
                  {uploadResult && (
                    <div className="p-4 rounded-xl bg-green-50 border border-green-200 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-green-800">
                        <CheckCircle className="w-4 h-4" />
                        {uploadResult.totalCategories} categories updated
                      </div>
                      <div className="space-y-1">
                        {uploadResult.categories.map((cat) => (
                          <div key={cat.name} className="text-sm text-green-700 flex items-center gap-2">
                            <span className="font-medium">{cat.name}</span>
                            <span className="text-green-500">·</span>
                            <span>{cat.itemCount} words</span>
                            {cat.created && <span className="text-xs bg-green-200 text-green-800 px-1.5 py-0.5 rounded font-medium">NEW</span>}
                          </div>
                        ))}
                      </div>
                      {uploadResult.errors.length > 0 && (
                        <div className="text-xs text-amber-700 mt-2">
                          {uploadResult.errors.length} row(s) skipped
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ── Character Pool Management ── */}
        <Card className="border-2 border-[#39d5ff]/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>🕵️</span> Guess the Character — Pool
            </CardTitle>
            <CardDescription>
              Upload characters per language. Column A = answer, Columns B–K = up to 10 hints.
              A header row is skipped automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Language tabs */}
            <div className="flex gap-2">
              {(['en', 'ar'] as const).map(l => (
                <button
                  key={l}
                  onClick={() => setCharLang(l)}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${
                    charLang === l
                      ? 'bg-[#39d5ff] text-black'
                      : 'border border-[#39d5ff]/50 text-[#39d5ff] hover:bg-[#39d5ff]/10'
                  }`}
                >
                  {l === 'en' ? '🇬🇧 English' : '🇸🇦 Arabic'}
                </button>
              ))}
            </div>

            {/* CSV format hint */}
            <div className="p-3 rounded-lg bg-muted text-sm font-mono">
              {charLang === 'en'
                ? <>answer, hint1, hint2, hint3, …<br/>Batman, Cape, Gotham, Bruce Wayne, …</>
                : <span dir="rtl">الجواب, تلميح1, تلميح2, …<br/>باتمان, رداء, غوثام, …</span>
              }
            </div>

            {/* Upload button */}
            <input
              ref={charFileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleCharacterUpload(file, charLang);
              }}
            />
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="gap-2 border-[#39d5ff] text-[#39d5ff] hover:bg-[#39d5ff]/10"
                disabled={uploadingChar}
                onClick={() => charFileRef.current?.click()}
              >
                <Upload className="w-4 h-4" />
                {uploadingChar ? 'Uploading...' : `Upload ${charLang === 'en' ? 'English' : 'Arabic'} CSV`}
              </Button>
            </div>

            {uploadErrorChar && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {uploadErrorChar}
              </div>
            )}
            {uploadResultChar && (
              <div className="p-4 rounded-xl bg-green-50 border border-green-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-green-800">
                  <CheckCircle className="w-4 h-4" />
                  {uploadResultChar.imported} characters imported
                  {uploadResultChar.skipped > 0 && <span className="text-xs font-normal text-green-600">({uploadResultChar.skipped} skipped)</span>}
                </div>
                {uploadResultChar.errors.length > 0 && (
                  <div className="text-xs text-amber-700">
                    {uploadResultChar.errors.slice(0, 5).join(', ')}
                  </div>
                )}
              </div>
            )}

            {/* Character list */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                Loaded Characters
                <span className="text-xs font-normal text-muted-foreground">
                  ({characters.filter(c => c.lang === charLang).length} {charLang === 'en' ? 'English' : 'Arabic'})
                </span>
                <button onClick={fetchCharacters} className="text-xs text-[#39d5ff] hover:underline ml-auto">
                  Refresh
                </button>
              </h3>
              {charsLoading ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ) : characters.filter(c => c.lang === charLang).length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No {charLang === 'en' ? 'English' : 'Arabic'} characters yet. Upload a CSV above.
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {characters
                    .filter(c => c.lang === charLang)
                    .map(char => (
                      <div
                        key={char.id}
                        className="flex items-center justify-between p-3 border rounded-xl bg-card"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold truncate" dir={charLang === 'ar' ? 'rtl' : 'ltr'}>
                            {char.answer}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {char.hints.length} hint{char.hints.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0 ml-2"
                          onClick={() => handleDeleteCharacter(char.id, char.answer)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Category List ── */}
        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
            <CardDescription>
              Toggle categories on or off for players to see. Delete ones you no longer need.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : categories?.length === 0 ? (
              <p className="text-muted-foreground">No categories yet. Upload your master file above to get started.</p>
            ) : (
              <div className="space-y-3">
                {categories?.map((cat) => (
                  <div
                    key={cat.id}
                    data-testid={`card-category-${cat.id}`}
                    className="flex items-center justify-between p-4 border rounded-xl bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="font-bold text-lg">{cat.name}</h3>
                        <p className="text-sm text-muted-foreground">{cat.itemCount} words</p>
                      </div>
                      {cat.type === 'en' && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 border border-pink-300">EN</span>
                      )}
                      {cat.type === 'ar' && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 border border-cyan-300">AR</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">
                          {cat.enabled ? 'Active' : 'Hidden'}
                        </span>
                        <Switch
                          data-testid={`switch-category-${cat.id}`}
                          checked={cat.enabled}
                          onCheckedChange={(checked) => toggleCategory(cat.id, checked)}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid={`button-delete-category-${cat.id}`}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(cat.id, cat.name)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
