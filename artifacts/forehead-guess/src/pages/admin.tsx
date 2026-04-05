import { useState, useRef } from 'react';
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

function AdminDashboard({ password, onLogout }: { password: string; onLogout: () => void }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: categories, isLoading, refetch } = useAdminListCategories({
    request: { headers: { 'x-admin-password': password } }
  });
  const updateCategory = useAdminUpdateCategory();
  const deleteCategory = useAdminDeleteCategory();

  const handleMasterUpload = async (file: File) => {
    setUploading(true);
    setUploadResult(null);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/upload-master', {
        method: 'POST',
        headers: { 'x-admin-password': password },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || 'Upload failed');
      } else {
        setUploadResult(data as UploadResult);
        toast({ title: 'Master file uploaded!', description: `${data.totalCategories} categories updated.` });
        refetch();
      }
    } catch {
      setUploadError('Network error — could not upload file.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
        {/* ── Master File Upload ── */}
        <Card className="border-2 border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Upload Master Category File
            </CardTitle>
            <CardDescription className="text-base leading-relaxed">
              Upload one CSV or Excel file where <strong>each column is a category</strong>.
              The first row of each column is the <strong>category name</strong>.
              Every row below it is a <strong>possible word</strong> for that category.
              Adding a new column automatically creates a new category.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Format example */}
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
                <div className="text-muted-foreground">Tennis</div>
                <div className="text-muted-foreground">Frozen</div>
                <div className="text-muted-foreground">Penguin</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                data-testid="input-master-file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleMasterUpload(file);
                }}
              />
              <Button
                size="lg"
                className="gap-2"
                disabled={uploading}
                data-testid="button-upload-master"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4" />
                {uploading ? 'Uploading...' : 'Choose File to Upload'}
              </Button>
              <span className="text-sm text-muted-foreground">CSV or Excel (.xlsx)</span>
            </div>

            {/* Upload result */}
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
                  Upload complete — {uploadResult.totalCategories} categories updated
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
                    {uploadResult.errors.length} row(s) skipped: {uploadResult.errors.slice(0, 3).join(', ')}
                  </div>
                )}
              </div>
            )}
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
                    <div>
                      <h3 className="font-bold text-lg">{cat.name}</h3>
                      <p className="text-sm text-muted-foreground">{cat.itemCount} words</p>
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
