import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  useAdminVerify, 
  useAdminListCategories, 
  useAdminCreateCategory, 
  useAdminUpdateCategory, 
  useAdminDeleteCategory, 
  useAdminListItems, 
  useAdminUploadItems 
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';

const loginSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

const uploadSchema = z.object({
  file: z.any().refine((files) => files?.length == 1, "File is required.")
});

export default function Admin() {
  const { toast } = useToast();
  const [password, setPassword] = useState<string | null>(sessionStorage.getItem('fg_admin_pw'));
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

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
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={verifyMutation.isPending}>
                  Login
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

function AdminDashboard({ password, onLogout }: { password: string, onLogout: () => void }) {
  const { toast } = useToast();
  const { data: categories, isLoading, refetch } = useAdminListCategories({ 
    request: { headers: { 'x-admin-password': password } }
  });
  const updateCategory = useAdminUpdateCategory();
  
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

  return (
    <div className="min-h-[100dvh] p-6 bg-muted/10 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black">Admin Dashboard</h1>
        <Button variant="outline" onClick={onLogout}>Logout</Button>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <p>Loading...</p> : (
              <div className="space-y-4">
                {categories?.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-4 border rounded-xl bg-card">
                    <div>
                      <h3 className="font-bold text-lg">{cat.name}</h3>
                      <p className="text-sm text-muted-foreground">{cat.itemCount} items</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{cat.enabled ? 'Active' : 'Disabled'}</span>
                        <Switch checked={cat.enabled} onCheckedChange={(checked) => toggleCategory(cat.id, checked)} />
                      </div>
                      {/* More advanced stuff like upload would go here if needed */}
                      <CategoryUpload id={cat.id} password={password} onUploadComplete={() => refetch()} />
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

function CategoryUpload({ id, password, onUploadComplete }: { id: number, password: string, onUploadComplete: () => void }) {
  const { toast } = useToast();
  const uploadItems = useAdminUploadItems();
  
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    uploadItems.mutate(
      { id, data: { file } },
      {
        request: { headers: { 'x-admin-password': password } },
        onSuccess: (res) => {
          toast({ title: 'Upload complete', description: `Imported ${res.imported}, skipped ${res.skipped}` });
          onUploadComplete();
        },
        onError: () => toast({ title: 'Upload failed', variant: 'destructive' })
      }
    );
  };

  return (
    <div>
      <Input type="file" accept=".csv,.xlsx" className="max-w-[200px]" onChange={handleUpload} disabled={uploadItems.isPending} />
    </div>
  );
}
