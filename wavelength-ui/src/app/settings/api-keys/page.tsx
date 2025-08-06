"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Key, 
  Plus, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  Edit,
  Loader2,
  AlertCircle,
  Shield
} from 'lucide-react';
import { useStore } from '@/lib/store';

interface ApiKeyData {
  id: string;
  provider: string;
  keyName: string | null;
  isActive: boolean;
  dailyLimit: number | null;
  monthlyLimit: number | null;
  usedToday: number;
  usedThisMonth: number;
  lastUsed: string | null;
  lastValidated: string | null;
  isValid: boolean;
  validationError: string | null;
  createdAt: string;
  updatedAt: string;
}

const PROVIDER_OPTIONS = [
  { id: 'openrouter', name: 'OpenRouter', description: 'Access to multiple AI models' },
  { id: 'openai', name: 'OpenAI', description: 'GPT-4, GPT-3.5, and other OpenAI models' },
  { id: 'anthropic', name: 'Anthropic', description: 'Claude models' },
  { id: 'google', name: 'Google AI', description: 'Gemini models' },
  { id: 'xai', name: 'XAI', description: 'Grok models' },
];

export default function ApiKeysPage() {
  const { auth } = useStore();
  const [apiKeys, setApiKeys] = useState<ApiKeyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKeyData | null>(null);
  // const [showKeyValues, setShowKeyValues] = useState<Record<string, boolean>>({});

  // New key form data
  const [newKeyForm, setNewKeyForm] = useState({
    provider: '',
    apiKey: '',
    keyName: '',
    dailyLimit: '',
    monthlyLimit: '',
  });

  // Edit key form data
  const [editKeyForm, setEditKeyForm] = useState({
    keyName: '',
    dailyLimit: '',
    monthlyLimit: '',
    isActive: true,
  });

  useEffect(() => {
    if (auth.user.sessionType === 'authenticated') {
      loadApiKeys();
    } else {
      setLoading(false);
    }
  }, [auth.user.sessionType]);

  const loadApiKeys = async () => {
    try {
      const response = await fetch('/api/profile/api-keys');
      const data = await response.json();
      
      if (data.success) {
        setApiKeys(data.data);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to load API keys' });
      }
    } catch (error) {
      console.error('Failed to load API keys:', error);
      setMessage({ type: 'error', text: 'Failed to load API keys' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddKey = async () => {
    if (!newKeyForm.provider || !newKeyForm.apiKey) {
      setMessage({ type: 'error', text: 'Provider and API key are required' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const requestData = {
        provider: newKeyForm.provider,
        apiKey: newKeyForm.apiKey,
        keyName: newKeyForm.keyName || undefined,
        dailyLimit: newKeyForm.dailyLimit ? parseInt(newKeyForm.dailyLimit) : undefined,
        monthlyLimit: newKeyForm.monthlyLimit ? parseInt(newKeyForm.monthlyLimit) : undefined,
      };

      const response = await fetch('/api/profile/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: data.message || 'API key added successfully' });
        setShowAddDialog(false);
        setNewKeyForm({
          provider: '',
          apiKey: '',
          keyName: '',
          dailyLimit: '',
          monthlyLimit: '',
        });
        await loadApiKeys();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to add API key' });
      }
    } catch (error) {
      console.error('Failed to add API key:', error);
      setMessage({ type: 'error', text: 'Failed to add API key' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateKey = async (keyId: string) => {
    setSaving(true);
    setMessage(null);

    try {
      const requestData = {
        keyName: editKeyForm.keyName || undefined,
        dailyLimit: editKeyForm.dailyLimit ? parseInt(editKeyForm.dailyLimit) : undefined,
        monthlyLimit: editKeyForm.monthlyLimit ? parseInt(editKeyForm.monthlyLimit) : undefined,
        isActive: editKeyForm.isActive,
      };

      const response = await fetch(`/api/profile/api-keys/${keyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: data.message || 'API key updated successfully' });
        setEditingKey(null);
        await loadApiKeys();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update API key' });
      }
    } catch (error) {
      console.error('Failed to update API key:', error);
      setMessage({ type: 'error', text: 'Failed to update API key' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/profile/api-keys/${keyId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: data.message || 'API key deleted successfully' });
        await loadApiKeys();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to delete API key' });
      }
    } catch (error) {
      console.error('Failed to delete API key:', error);
      setMessage({ type: 'error', text: 'Failed to delete API key' });
    } finally {
      setSaving(false);
    }
  };

  const formatUsagePercentage = (used: number, limit: number | null) => {
    if (!limit) return null;
    const percentage = (used / limit) * 100;
    return Math.min(percentage, 100);
  };

  const getUsageColor = (used: number, limit: number | null) => {
    if (!limit) return 'bg-gray-200';
    const percentage = (used / limit) * 100;
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (auth.user.sessionType === 'anonymous') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>API Key Management</CardTitle>
          <CardDescription>Sign in to manage your API keys</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Key className="h-4 w-4" />
            <AlertDescription>
              API key management is only available for signed-in users. Please sign in to manage your API keys.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="ml-2">Loading API keys...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                API Key Management
              </CardTitle>
              <CardDescription>
                Manage your AI provider API keys securely
              </CardDescription>
            </div>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add API Key
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New API Key</DialogTitle>
                  <DialogDescription>
                    Add an API key for a new provider
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="provider">Provider</Label>
                    <Select
                      value={newKeyForm.provider}
                      onValueChange={(value) => setNewKeyForm(prev => ({ ...prev, provider: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVIDER_OPTIONS.map((provider) => (
                          <SelectItem key={provider.id} value={provider.id}>
                            <div>
                              <div className="font-medium">{provider.name}</div>
                              <div className="text-xs text-muted-foreground">{provider.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="apiKey">API Key</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      value={newKeyForm.apiKey}
                      onChange={(e) => setNewKeyForm(prev => ({ ...prev, apiKey: e.target.value }))}
                      placeholder="Enter your API key"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="keyName">Key Name (Optional)</Label>
                    <Input
                      id="keyName"
                      type="text"
                      value={newKeyForm.keyName}
                      onChange={(e) => setNewKeyForm(prev => ({ ...prev, keyName: e.target.value }))}
                      placeholder="e.g., Personal Key, Work Key"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="dailyLimit">Daily Limit (Optional)</Label>
                      <Input
                        id="dailyLimit"
                        type="number"
                        value={newKeyForm.dailyLimit}
                        onChange={(e) => setNewKeyForm(prev => ({ ...prev, dailyLimit: e.target.value }))}
                        placeholder="100"
                      />
                    </div>
                    <div>
                      <Label htmlFor="monthlyLimit">Monthly Limit (Optional)</Label>
                      <Input
                        id="monthlyLimit"
                        type="number"
                        value={newKeyForm.monthlyLimit}
                        onChange={(e) => setNewKeyForm(prev => ({ ...prev, monthlyLimit: e.target.value }))}
                        placeholder="3000"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowAddDialog(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddKey} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Adding...
                      </>
                    ) : (
                      'Add Key'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {message && (
            <Alert className={`mb-4 ${message.type === 'error' ? 'border-destructive' : 'border-green-200'}`}>
              {message.type === 'error' ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
              <AlertDescription className={message.type === 'success' ? 'text-green-700' : ''}>
                {message.text}
              </AlertDescription>
            </Alert>
          )}

          {apiKeys.length === 0 ? (
            <div className="text-center py-8">
              <Key className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No API Keys</h3>
              <p className="text-muted-foreground mb-4">
                Add your first API key to start using AI providers
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((apiKey) => {
                const provider = PROVIDER_OPTIONS.find(p => p.id === apiKey.provider);
                const dailyPercentage = formatUsagePercentage(apiKey.usedToday, apiKey.dailyLimit);
                const monthlyPercentage = formatUsagePercentage(apiKey.usedThisMonth, apiKey.monthlyLimit);
                
                return (
                  <Card key={apiKey.id} className="relative">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Shield className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <h3 className="font-medium">
                                {provider?.name || apiKey.provider}
                                {apiKey.keyName && (
                                  <span className="text-muted-foreground"> - {apiKey.keyName}</span>
                                )}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {provider?.description || `${apiKey.provider} API key`}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 mb-3">
                            <Badge variant={apiKey.isActive ? 'default' : 'secondary'}>
                              {apiKey.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            <Badge variant={apiKey.isValid ? 'default' : 'destructive'}>
                              {apiKey.isValid ? (
                                <>
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Valid
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Invalid
                                </>
                              )}
                            </Badge>
                            {apiKey.lastUsed && (
                              <span className="text-xs text-muted-foreground">
                                Last used: {new Date(apiKey.lastUsed).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          
                          {/* Usage Information */}
                          <div className="space-y-2">
                            {apiKey.dailyLimit && (
                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span>Daily Usage</span>
                                  <span>{apiKey.usedToday} / {apiKey.dailyLimit}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${getUsageColor(apiKey.usedToday, apiKey.dailyLimit)}`}
                                    style={{ width: `${dailyPercentage}%` }}
                                  />
                                </div>
                              </div>
                            )}
                            
                            {apiKey.monthlyLimit && (
                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span>Monthly Usage</span>
                                  <span>{apiKey.usedThisMonth} / {apiKey.monthlyLimit}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${getUsageColor(apiKey.usedThisMonth, apiKey.monthlyLimit)}`}
                                    style={{ width: `${monthlyPercentage}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {apiKey.validationError && (
                            <Alert className="mt-3 border-destructive">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>
                                {apiKey.validationError}
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingKey(apiKey);
                              setEditKeyForm({
                                keyName: apiKey.keyName || '',
                                dailyLimit: apiKey.dailyLimit?.toString() || '',
                                monthlyLimit: apiKey.monthlyLimit?.toString() || '',
                                isActive: apiKey.isActive,
                              });
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteKey(apiKey.id)}
                            disabled={saving}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Key Dialog */}
      {editingKey && (
        <Dialog open={!!editingKey} onOpenChange={() => setEditingKey(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit API Key</DialogTitle>
              <DialogDescription>
                Update settings for {PROVIDER_OPTIONS.find(p => p.id === editingKey.provider)?.name || editingKey.provider}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="editKeyName">Key Name</Label>
                <Input
                  id="editKeyName"
                  type="text"
                  value={editKeyForm.keyName}
                  onChange={(e) => setEditKeyForm(prev => ({ ...prev, keyName: e.target.value }))}
                  placeholder="e.g., Personal Key, Work Key"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editDailyLimit">Daily Limit</Label>
                  <Input
                    id="editDailyLimit"
                    type="number"
                    value={editKeyForm.dailyLimit}
                    onChange={(e) => setEditKeyForm(prev => ({ ...prev, dailyLimit: e.target.value }))}
                    placeholder="100"
                  />
                </div>
                <div>
                  <Label htmlFor="editMonthlyLimit">Monthly Limit</Label>
                  <Input
                    id="editMonthlyLimit"
                    type="number"
                    value={editKeyForm.monthlyLimit}
                    onChange={(e) => setEditKeyForm(prev => ({ ...prev, monthlyLimit: e.target.value }))}
                    placeholder="3000"
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editKeyForm.isActive}
                  onChange={(e) => setEditKeyForm(prev => ({ ...prev, isActive: e.target.checked }))}
                />
                <Label htmlFor="editIsActive">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setEditingKey(null)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={() => handleUpdateKey(editingKey.id)} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Updating...
                  </>
                ) : (
                  'Update Key'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}