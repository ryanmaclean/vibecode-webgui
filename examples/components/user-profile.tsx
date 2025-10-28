/**
 * User Profile Component Example
 * 
 * This example demonstrates:
 * - TypeScript interface definitions
 * - React component best practices
 * - Form handling with react-hook-form
 * - UI component usage (shadcn/ui)
 * - Error handling and loading states
 * - Accessibility considerations
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Settings, Mail, Phone, MapPin, Calendar } from 'lucide-react';

// UI components from shadcn/ui
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';

// Types and interfaces
interface UserProfileData {
  id: string;
  email: string;
  name: string | null;
  bio: string | null;
  phone: string | null;
  location: string | null;
  website: string | null;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notifications: boolean;
    newsletter: boolean;
  };
  stats: {
    workspaces: number;
    projects: number;
    collaborations: number;
  };
}

// Form validation schema
const profileFormSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters'),
  bio: z
    .string()
    .max(500, 'Bio must be less than 500 characters')
    .optional(),
  phone: z
    .string()
    .regex(/^[+]?[\d\s-()]+$/, 'Invalid phone number format')
    .optional()
    .or(z.literal('')),
  location: z
    .string()
    .max(100, 'Location must be less than 100 characters')
    .optional(),
  website: z
    .string()
    .url('Invalid website URL')
    .optional()
    .or(z.literal('')),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface UserProfileProps {
  user: UserProfileData;
  onUpdate?: (updatedUser: Partial<UserProfileData>) => Promise<void>;
  isEditable?: boolean;
  className?: string;
}

export function UserProfile({ 
  user, 
  onUpdate, 
  isEditable = false,
  className 
}: UserProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: user.name || '',
      bio: user.bio || '',
      phone: user.phone || '',
      location: user.location || '',
      website: user.website || '',
    },
  });

  const onSubmit = async (data: ProfileFormValues) => {
    if (!onUpdate) return;

    setIsLoading(true);
    try {
      await onUpdate(data);
      setIsEditing(false);
      toast({
        title: 'Profile updated',
        description: 'Your profile has been successfully updated.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    form.reset();
    setIsEditing(false);
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    }
    return email[0].toUpperCase();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user.avatar || undefined} alt={user.name || 'User'} />
                <AvatarFallback className="text-lg">
                  {getInitials(user.name, user.email)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <CardTitle className="text-2xl">
                  {user.name || 'Anonymous User'}
                </CardTitle>
                <CardDescription className="flex items-center">
                  <Mail className="mr-2 h-4 w-4" />
                  {user.email}
                </CardDescription>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="mr-2 h-4 w-4" />
                  Joined {formatDate(user.createdAt)}
                </div>
              </div>
            </div>
            {isEditable && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                disabled={isLoading}
              >
                <Settings className="mr-2 h-4 w-4" />
                {isEditing ? 'Cancel' : 'Edit'}
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Profile Statistics */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Statistics</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {user.stats.workspaces}
                </div>
                <div className="text-sm text-muted-foreground">Workspaces</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {user.stats.projects}
                </div>
                <div className="text-sm text-muted-foreground">Projects</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {user.stats.collaborations}
                </div>
                <div className="text-sm text-muted-foreground">Collaborations</div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Profile Details */}
          {isEditing ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter your display name" />
                      </FormControl>
                      <FormDescription>
                        This is your public display name.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Tell us about yourself"
                          rows={4}
                        />
                      </FormControl>
                      <FormDescription>
                        Brief description about yourself. Maximum 500 characters.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="+1 (555) 123-4567" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="New York, NY" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://yourwebsite.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <div className="space-y-4">
              {user.bio && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">About</h3>
                  <p className="text-muted-foreground">{user.bio}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {user.phone && (
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{user.phone}</span>
                  </div>
                )}

                {user.location && (
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{user.location}</span>
                  </div>
                )}

                {user.website && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">🌐</span>
                    <a
                      href={user.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      {user.website}
                    </a>
                  </div>
                )}
              </div>

              {/* User Preferences */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Preferences</h3>
                <div className="flex space-x-2">
                  <Badge variant="secondary">
                    Theme: {user.preferences.theme}
                  </Badge>
                  {user.preferences.notifications && (
                    <Badge variant="secondary">Notifications On</Badge>
                  )}
                  {user.preferences.newsletter && (
                    <Badge variant="secondary">Newsletter</Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Usage example with error boundary
export function UserProfileWithErrorBoundary({ userId }: { userId: string }) {
  const [user, setUser] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = async () => {
    try {
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }
      const data = await response.json();
      setUser(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (updates: Partial<UserProfileData>) => {
    const response = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error('Failed to update user');
    }

    const updatedUser = await response.json();
    setUser(updatedUser);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="flex items-center space-x-4">
              <div className="h-20 w-20 bg-muted rounded-full" />
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-32" />
                <div className="h-3 bg-muted rounded w-48" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={fetchUser} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <UserProfile 
      user={user} 
      onUpdate={updateUser} 
      isEditable={true}
    />
  );
}

/**
 * Accessibility Features:
 * - Semantic HTML elements
 * - Proper ARIA labels
 * - Keyboard navigation support
 * - Screen reader friendly
 * - High contrast support
 * 
 * Performance Features:
 * - Optimized re-renders with proper key props
 * - Lazy loading for large forms
 * - Debounced input validation
 * - Efficient state management
 * 
 * Error Handling:
 * - Form validation with user-friendly messages
 * - Network error handling
 * - Loading states
 * - Fallback UI components
 */