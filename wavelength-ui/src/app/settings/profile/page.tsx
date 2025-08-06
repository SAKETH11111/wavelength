"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  User, 
  Mail, 
  Calendar, 
  Shield, 
  Save, 
  Loader2,
  AlertCircle,
  CheckCircle,
  Camera
} from 'lucide-react';
import { useStore } from '@/lib/store';

interface ProfileData {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    tier: string;
    createdAt: string;
    lastLoginAt: string | null;
  };
  profile: {
    displayName: string | null;
    bio: string | null;
    timezone: string | null;
    language: string | null;
    theme: string | null;
  } | null;
  stats: {
    totalChats: number;
    totalMessages: number;
  };
}

export default function ProfilePage() {
  const { auth } = useStore();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  
  // Form data
  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    timezone: '',
    language: '',
    theme: 'auto' as 'light' | 'dark' | 'auto',
  });

  // Load profile data
  useEffect(() => {
    if (auth.user.sessionType === 'authenticated') {
      loadProfileData();
    } else {
      setLoading(false);
    }
  }, [auth.user.sessionType]);

  const loadProfileData = async () => {
    try {
      const response = await fetch('/api/profile');
      const data = await response.json();
      
      if (data.success) {
        setProfileData(data.data);
        setFormData({
          displayName: data.data.profile?.displayName || '',
          bio: data.data.profile?.bio || '',
          timezone: data.data.profile?.timezone || '',
          language: data.data.profile?.language || 'en',
          theme: (data.data.profile?.theme || 'auto') as 'light' | 'dark' | 'auto',
        });
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      setMessage({ type: 'error', text: 'Failed to load profile data' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully' });
        await loadProfileData(); // Reload to get fresh data
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update profile' });
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
      setMessage({ type: 'error', text: 'Failed to save changes' });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select a valid image file' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setMessage({ type: 'error', text: 'Image must be smaller than 5MB' });
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // TODO: Implement actual upload to server
    setMessage({ type: 'success', text: 'Avatar updated (feature in development)' });
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (auth.user.sessionType === 'anonymous') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
          <CardDescription>Sign in to access profile settings</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <User className="h-4 w-4" />
            <AlertDescription>
              Profile settings are only available for signed-in users. Please sign in to manage your profile.
            </AlertDescription>
          </Alert>
          <Button className="mt-4" onClick={() => {/* TODO: Open auth modal */}}>
            Sign In
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="ml-2">Loading profile...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Profile Information
          </CardTitle>
          <CardDescription>
            Manage your personal information and preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {message && (
            <Alert className={message.type === 'error' ? 'border-destructive' : 'border-green-200'}>
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

          {/* Avatar Section */}
          <div className="flex items-center gap-4">
            <Avatar className="w-20 h-20">
              <AvatarImage 
                src={avatarPreview || profileData?.user.image || ''} 
                alt={profileData?.user.name || profileData?.user.email || 'User'} 
              />
              <AvatarFallback className="text-lg">
                {profileData?.user.name?.charAt(0) || 
                 profileData?.user.email?.charAt(0) || 
                 <User className="w-8 h-8" />}
              </AvatarFallback>
            </Avatar>
            <div>
              <Label htmlFor="avatar-upload" className="cursor-pointer">
                <Button variant="outline" className="gap-2" asChild>
                  <span>
                    <Camera className="w-4 h-4" />
                    Change Avatar
                  </span>
                </Button>
              </Label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <p className="text-xs text-muted-foreground mt-1">
                JPG, PNG or GIF. Max 5MB.
              </p>
            </div>
          </div>

          <Separator />

          {/* Account Info (Read-only) */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Account Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">Email Address</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="font-mono text-sm">{profileData?.user.email}</span>
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Account Tier</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <Badge variant={profileData?.user.tier === 'pro' ? 'default' : 'secondary'}>
                    {profileData?.user.tier?.toUpperCase() || 'FREE'}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Member Since</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    {profileData?.user.createdAt 
                      ? new Date(profileData.user.createdAt).toLocaleDateString()
                      : 'Unknown'
                    }
                  </span>
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Last Login</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    {profileData?.user.lastLoginAt 
                      ? new Date(profileData.user.lastLoginAt).toLocaleDateString()
                      : 'Never'
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Editable Profile Fields */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Profile Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => handleInputChange('displayName', e.target.value)}
                  placeholder="Your display name"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="language">Language</Label>
                <Select
                  value={formData.language}
                  onValueChange={(value) => handleInputChange('language', value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="ja">Japanese</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={formData.timezone}
                  onValueChange={(value) => handleInputChange('timezone', value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">Eastern Time</SelectItem>
                    <SelectItem value="America/Chicago">Central Time</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                    <SelectItem value="Europe/London">London</SelectItem>
                    <SelectItem value="Europe/Paris">Paris</SelectItem>
                    <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="theme">Theme Preference</Label>
                <Select
                  value={formData.theme}
                  onValueChange={(value: 'light' | 'dark' | 'auto') => handleInputChange('theme', value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (System)</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                placeholder="Tell us about yourself..."
                className="mt-1 min-h-[100px]"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formData.bio.length}/500 characters
              </p>
            </div>
          </div>

          <Separator />

          {/* Save Button */}
          <div className="flex justify-end">
            <Button 
              onClick={handleSaveProfile}
              disabled={saving}
              className="gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Usage Statistics */}
      {profileData?.stats && (
        <Card>
          <CardHeader>
            <CardTitle>Account Statistics</CardTitle>
            <CardDescription>Your usage overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {profileData.stats.totalChats}
                </div>
                <p className="text-sm text-muted-foreground">Total Conversations</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {profileData.stats.totalMessages}
                </div>
                <p className="text-sm text-muted-foreground">Total Messages</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}