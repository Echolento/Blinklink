import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { insertTemporaryLinkSchema, type InsertTemporaryLink, type TemporaryLink } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Link, Clock, Eye, CheckCircle, Copy, Trash2, RefreshCw } from "lucide-react";

const STORAGE_KEY = "blinklink_session";

export default function Home() {
  const [generatedLink, setGeneratedLink] = useState<TemporaryLink | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertTemporaryLink>({
    resolver: zodResolver(insertTemporaryLinkSchema),
    defaultValues: {
      destinationUrl: "",
      expirationMode: "1-click",
    },
  });

  // Save session to localStorage with error handling
  const saveSession = (link: TemporaryLink | null, formData?: InsertTemporaryLink) => {
    try {
      const sessionData = {
        link,
        formData: formData || form.getValues(),
        timestamp: Date.now(),
        version: "1.0", // For future compatibility
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
    } catch (error) {
      console.error("Failed to save session:", error);
      // If localStorage is full or unavailable, clear old data and try again
      try {
        localStorage.removeItem(STORAGE_KEY);
        const sessionData = {
          link,
          formData: formData || form.getValues(),
          timestamp: Date.now(),
          version: "1.0",
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
      } catch (retryError) {
        console.error("Failed to save session after retry:", retryError);
      }
    }
  };

  // Restore session from localStorage
  const restoreSession = async () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setIsRestoringSession(false);
        return;
      }

      const sessionData = JSON.parse(stored);
      const { link, formData, timestamp, version } = sessionData;

      // Check if session is older than 24 hours
      if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(STORAGE_KEY);
        setIsRestoringSession(false);
        return;
      }

      // Restore form data first (even if no link exists)
      if (formData) {
        form.reset(formData);
      }

      // Restore link if it exists
      if (link) {
        // Verify the link still exists on the server
        try {
          const response = await apiRequest("GET", `/api/links/${link.shortId}`);
          const serverLink = await response.json();
          setGeneratedLink(serverLink);
          
          toast({
            title: "Session Restored",
            description: "Your previous link and form data have been restored.",
          });
        } catch (error) {
          // Link no longer exists on server, but keep form data
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            link: null,
            formData,
            timestamp,
            version
          }));
          
          if (formData?.destinationUrl) {
            toast({
              title: "Form Data Restored",
              description: "Your form data has been restored, but the previous link has expired.",
              variant: "destructive",
            });
          }
        }
      } else if (formData?.destinationUrl) {
        toast({
          title: "Form Data Restored",
          description: "Your form data has been restored from your previous session.",
        });
      }
    } catch (error) {
      console.error("Failed to restore session:", error);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsRestoringSession(false);
    }
  };

  // Clear session
  const clearSession = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  // Restore session on component mount
  useEffect(() => {
    restoreSession();
  }, []);

  // Save session when tab/window is about to close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (generatedLink || form.getValues().destinationUrl) {
        saveSession(generatedLink);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Save session when tab becomes hidden (user switches tabs)
        if (generatedLink || form.getValues().destinationUrl) {
          saveSession(generatedLink);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [generatedLink, form]);

  // Watch form changes and save to localStorage
  useEffect(() => {
    const subscription = form.watch((value) => {
      if (!isRestoringSession) {
        saveSession(generatedLink, value as InsertTemporaryLink);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, generatedLink, isRestoringSession]);

  // Save session when generatedLink changes
  useEffect(() => {
    if (!isRestoringSession) {
      saveSession(generatedLink);
    }
  }, [generatedLink, isRestoringSession]);

  const createLinkMutation = useMutation({
    mutationFn: async (data: InsertTemporaryLink) => {
      const res = await apiRequest("POST", "/api/links", data);
      return res.json();
    },
    onSuccess: (data: TemporaryLink) => {
      setGeneratedLink(data);
      saveSession(data);
      toast({
        title: "Link Generated!",
        description: "Your temporary link has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate link",
        variant: "destructive",
      });
    },
  });

  const deleteLinkMutation = useMutation({
    mutationFn: async (shortId: string) => {
      const res = await apiRequest("DELETE", `/api/links/${shortId}`);
      return res.json();
    },
    onSuccess: () => {
      if (generatedLink) {
        const expiredLink = { ...generatedLink, isExpired: true };
        setGeneratedLink(expiredLink);
        saveSession(expiredLink);
      }
      toast({
        title: "Link Deleted",
        description: "Your temporary link has been deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete link",
        variant: "destructive",
      });
    },
  });

  const { data: linkStatus } = useQuery({
    queryKey: ["/api/links", generatedLink?.shortId],
    enabled: !!generatedLink && !generatedLink.isExpired,
    refetchInterval: 5000,
  });

  const currentLink = linkStatus || generatedLink;

  const onSubmit = (data: InsertTemporaryLink) => {
    createLinkMutation.mutate(data);
  };

  const copyToClipboard = async () => {
    if (currentLink) {
      const linkUrl = `${window.location.origin}/t/${currentLink.shortId}`;
      await navigator.clipboard.writeText(linkUrl);
      toast({
        title: "Copied!",
        description: "Link copied to clipboard.",
      });
    }
  };

  const createAnother = () => {
    form.reset();
    setGeneratedLink(null);
    clearSession();
  };

  const deleteLink = () => {
    if (currentLink) {
      deleteLinkMutation.mutate(currentLink.shortId);
    }
  };

  const getExpirationText = (mode: string) => {
    switch (mode) {
      case "1-click":
        return "After 1 click";
      case "1-hour":
        return "In 1 hour";
      case "24-hours":
        return "In 24 hours";
      default:
        return mode;
    }
  };

  const getTimeRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Show loading state while restoring session
  if (isRestoringSession) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
        <Card className="bg-slate-800 border-slate-700 card-glow w-full max-w-md">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col items-center space-y-4">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
              <h2 className="text-lg sm:text-xl font-semibold text-white">Restoring Session...</h2>
              <p className="text-slate-400 text-center text-sm sm:text-base">
                Checking for your previous link and restoring your session.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
                <Link className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Blinklink</h1>
            </div>
            <div className="flex flex-col sm:flex-row items-end sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 text-xs sm:text-sm text-slate-400">
              <span className="hidden sm:inline">Temporary Link Generator</span>
              <span className="sm:hidden">Link Generator</span>
              {generatedLink && (
                <span className="text-green-400 text-xs">• Active</span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 sm:py-12">
        {/* Hero Section */}
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-4xl font-bold mb-3 sm:mb-4 bg-gradient-to-r from-white to-blue-400 bg-clip-text text-transparent">
            Create Temporary Links
          </h2>
          <p className="text-slate-400 text-sm sm:text-lg max-w-2xl mx-auto px-2">
            Generate secure temporary links that expire automatically. Perfect for sharing sensitive content with time-limited access.
          </p>
        </div>

        {/* Link Generator */}
        <div className="max-w-2xl mx-auto">
          <Card className="bg-slate-800 border-slate-700 card-glow">
            <CardContent className="p-4 sm:p-8">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
                  {/* URL Input */}
                  <FormField
                    control={form.control}
                    name="destinationUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300 text-sm sm:text-base">Destination URL</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              placeholder="https://example.com/your-link"
                              className="bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12 h-10 sm:h-11 text-sm sm:text-base"
                            />
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                              <Link className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                            </div>
                          </div>
                        </FormControl>
                        <FormDescription className="text-slate-500 text-xs sm:text-sm">
                          Enter the URL you want to create a temporary link for
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Expiration Options */}
                  <FormField
                    control={form.control}
                    name="expirationMode"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-slate-300 text-sm sm:text-base">Expiration Settings</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
                          >
                            <div>
                              <RadioGroupItem value="1-click" id="1-click" className="sr-only" />
                              <Label htmlFor="1-click" className="cursor-pointer">
                                <div className={`bg-slate-900 border rounded-lg p-3 sm:p-4 hover:border-blue-500 transition-colors h-16 sm:h-20 flex flex-col justify-center ${field.value === '1-click' ? 'border-blue-500' : 'border-slate-700'}`}>
                                  <p className="font-medium text-white text-sm sm:text-base">1 Click</p>
                                  <p className="text-xs sm:text-sm text-slate-400">Expires after first visit</p>
                                </div>
                              </Label>
                            </div>
                            <div>
                              <RadioGroupItem value="1-hour" id="1-hour" className="sr-only" />
                              <Label htmlFor="1-hour" className="cursor-pointer">
                                <div className={`bg-slate-900 border rounded-lg p-3 sm:p-4 hover:border-blue-500 transition-colors h-16 sm:h-20 flex flex-col justify-center ${field.value === '1-hour' ? 'border-blue-500' : 'border-slate-700'}`}>
                                  <p className="font-medium text-white text-sm sm:text-base">1 Hour</p>
                                  <p className="text-xs sm:text-sm text-slate-400">Expires in 60 minutes</p>
                                </div>
                              </Label>
                            </div>
                            <div>
                              <RadioGroupItem value="24-hours" id="24-hours" className="sr-only" />
                              <Label htmlFor="24-hours" className="cursor-pointer">
                                <div className={`bg-slate-900 border rounded-lg p-3 sm:p-4 hover:border-blue-500 transition-colors h-16 sm:h-20 flex flex-col justify-center ${field.value === '24-hours' ? 'border-blue-500' : 'border-slate-700'}`}>
                                  <p className="font-medium text-white text-sm sm:text-base">24 Hours</p>
                                  <p className="text-xs sm:text-sm text-slate-400">Expires in 1 day</p>
                                </div>
                              </Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Generate Button */}
                  <Button
                    type="submit"
                    disabled={createLinkMutation.isPending}
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white font-medium py-3 sm:py-4 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 h-12 sm:h-auto"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <Link className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="text-sm sm:text-base">
                        {createLinkMutation.isPending ? "Generating..." : "Generate Temporary Link"}
                      </span>
                    </div>
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Generated Link */}
        {currentLink && (
          <div className="max-w-2xl mx-auto mt-6 sm:mt-8">
            <Card className="bg-slate-800 border-slate-700 card-glow">
              <CardContent className="p-4 sm:p-8">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h3 className="text-lg sm:text-xl font-semibold text-white">Your Temporary Link</h3>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${currentLink.isExpired ? 'bg-red-500' : 'bg-green-500'}`} />
                    <span className={`text-xs sm:text-sm ${currentLink.isExpired ? 'text-red-400' : 'text-green-400'}`}>
                      {currentLink.isExpired ? "Expired" : "Active"}
                    </span>
                  </div>
                </div>

                {/* Generated Link Display */}
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
                  <div className="flex items-start sm:items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm text-slate-400 mb-1">Temporary Link</p>
                      <p className="text-blue-400 font-mono text-xs sm:text-sm break-all">
                        {`${window.location.origin}/t/${currentLink.shortId}`}
                      </p>
                    </div>
                    <Button
                      onClick={copyToClipboard}
                      variant="outline"
                      size="sm"
                      className="ml-2 sm:ml-4 bg-blue-500 hover:bg-blue-600 text-white border-blue-500 flex-shrink-0"
                    >
                      <Copy className="w-3 h-3 sm:w-4 sm:h-4" />
                    </Button>
                  </div>
                </div>

                {/* Link Statistics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 sm:p-4">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                      <div>
                        <p className="text-xs sm:text-sm text-slate-400">Expires</p>
                        <p className="font-medium text-white text-sm sm:text-base">{getExpirationText(currentLink.expirationMode)}</p>
                        {currentLink.expiresAt && (
                          <p className="text-xs text-slate-500">{getTimeRemaining(currentLink.expiresAt)}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 sm:p-4">
                    <div className="flex items-center space-x-2">
                      <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                      <div>
                        <p className="text-xs sm:text-sm text-slate-400">Views</p>
                        <p className="font-medium text-white text-sm sm:text-base">{currentLink.clickCount}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 sm:p-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                      <div>
                        <p className="text-xs sm:text-sm text-slate-400">Status</p>
                        <p className={`font-medium text-sm sm:text-base ${currentLink.isExpired ? 'text-red-400' : 'text-green-400'}`}>
                          {currentLink.isExpired ? "Expired" : "Active"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={createAnother}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium h-10 sm:h-auto text-sm sm:text-base"
                  >
                    Create Another Link
                  </Button>
                  <Button
                    onClick={deleteLink}
                    disabled={deleteLinkMutation.isPending || currentLink.isExpired}
                    variant="destructive"
                    className="flex-1 h-10 sm:h-auto text-sm sm:text-base"
                  >
                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                    Delete Link
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Features */}
        <div className="max-w-4xl mx-auto mt-16">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-white mb-4">Why Use Blinklink?</h3>
            <p className="text-slate-400">Secure, temporary links for better privacy and control</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Secure & Private</h4>
              <p className="text-slate-400">Links automatically expire to protect your content from unauthorized access.</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Lightning Fast</h4>
              <p className="text-slate-400">Generate temporary links instantly with just a few clicks.</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Track Usage</h4>
              <p className="text-slate-400">Monitor link activity and expiration status in real-time.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700 bg-slate-800/50 backdrop-blur-sm mt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
                <Link className="w-5 h-5 text-white" />
              </div>
              <span className="text-white font-medium">Blinklink</span>
            </div>
            <div className="flex items-center space-x-6 text-sm text-slate-400">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-slate-700 text-center text-sm text-slate-500">
            <p>&copy; 2024 Blinklink. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
