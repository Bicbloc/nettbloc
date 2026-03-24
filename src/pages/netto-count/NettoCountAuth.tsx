/**
 * Netto Count - Authentication Page
 * Sign up / Sign in with Google reCAPTCHA
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Package, Eye, EyeOff, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { APP_ORIGIN } from '@/constants/appUrl';
import { useToast } from "@/hooks/use-toast";

// Google reCAPTCHA Site Key - Production key should be stored as secret
// For production, replace with your verified site key from https://www.google.com/recaptcha/admin
const RECAPTCHA_SITE_KEY = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"; // Test key - works for development

declare global {
  interface Window {
    grecaptcha: any;
    onRecaptchaLoad: () => void;
  }
}

export default function NettoCountAuth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recaptchaLoaded, setRecaptchaLoaded] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [activeTab, setActiveTab] = useState("signin");
  
  // Track reCAPTCHA widget IDs for each tab
  const recaptchaWidgetIds = useRef<{ signin?: number; signup?: number }>({});
  const recaptchaContainerRefs = useRef<{ signin: HTMLDivElement | null; signup: HTMLDivElement | null }>({
    signin: null,
    signup: null
  });

  // Load reCAPTCHA script
  useEffect(() => {
    if (window.grecaptcha) {
      setRecaptchaLoaded(true);
      return;
    }

    window.onRecaptchaLoad = () => {
      setRecaptchaLoaded(true);
    };

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // Render reCAPTCHA for the active tab
  const renderRecaptcha = useCallback((tab: "signin" | "signup") => {
    if (!recaptchaLoaded || !window.grecaptcha || !window.grecaptcha.render) return;
    
    const containerId = `recaptcha-${tab}`;
    const container = document.getElementById(containerId);
    
    if (!container) return;
    
    // Check if already rendered for this tab
    if (recaptchaWidgetIds.current[tab] !== undefined) {
      // Reset existing widget
      try {
        window.grecaptcha.reset(recaptchaWidgetIds.current[tab]);
      } catch (e) {
      }
      return;
    }
    
    // Clear container first
    container.innerHTML = "";
    
    try {
      const widgetId = window.grecaptcha.render(containerId, {
        sitekey: RECAPTCHA_SITE_KEY,
        callback: (token: string) => setRecaptchaToken(token),
        "expired-callback": () => setRecaptchaToken(null),
        "error-callback": () => {
          setRecaptchaToken(null);
          setError("reCAPTCHA error. Please refresh the page.");
        }
      });
      recaptchaWidgetIds.current[tab] = widgetId;
    } catch (e) {
    }
  }, [recaptchaLoaded]);

  // Render reCAPTCHA when loaded or tab changes
  useEffect(() => {
    if (recaptchaLoaded) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        renderRecaptcha(activeTab as "signin" | "signup");
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [recaptchaLoaded, activeTab, renderRecaptcha]);

  // Reset token and error when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setRecaptchaToken(null);
    setError(null);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!recaptchaToken) {
      setError("Veuillez compléter la vérification reCAPTCHA");
      return;
    }

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${APP_ORIGIN}/netto-count/setup`,
          data: {
            full_name: fullName,
            app_type: "netto_count",
          },
        },
      });

      if (signUpError) throw signUpError;

      if (data.user) {
        // Create profile
        const { error: profileError } = await supabase
          .from("netto_count_profiles")
          .insert({
            user_id: data.user.id,
            email: email,
            full_name: fullName,
            email_confirmed: false,
          });

        if (profileError) {
          console.error("Profile creation error:", profileError);
        }

        setConfirmationSent(true);
        toast({
          title: "Email de confirmation envoyé ! ✉️",
          description: "Vérifiez votre boîte de réception et confirmez votre adresse email.",
        });
      }
    } catch (err: any) {
      console.error("Sign up error:", err);
      if (err.message?.includes("already registered")) {
        setError("Cet email est déjà utilisé. Essayez de vous connecter.");
      } else {
        setError(err.message || "Échec de l'inscription. Veuillez réessayer.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!recaptchaToken) {
      setError("Veuillez compléter la vérification reCAPTCHA");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      if (data.session) {
        // Check if user has item types configured
        const { data: itemTypes } = await supabase
          .from("netto_count_item_types")
          .select("id")
          .eq("user_id", data.user.id)
          .limit(1);

        if (itemTypes && itemTypes.length > 0) {
          navigate("/netto-count/scan");
        } else {
          navigate("/netto-count/setup");
        }
      }
    } catch (err: any) {
      console.error("Sign in error:", err);
      if (err.message?.includes("Invalid login credentials")) {
        setError("Email ou mot de passe incorrect");
      } else if (err.message?.includes("Email not confirmed")) {
        setError("Veuillez confirmer votre email avant de vous connecter");
      } else {
        setError(err.message || "Échec de la connexion. Veuillez réessayer.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (confirmationSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <Package className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Vérifiez votre email !</CardTitle>
            <CardDescription>
              Nous avons envoyé un lien de confirmation à <strong>{email}</strong>.
              Cliquez sur le lien pour activer votre compte.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Si vous ne recevez pas l'email, vérifiez votre dossier spam.
              </AlertDescription>
            </Alert>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setConfirmationSent(false)}
            >
              Retour à la connexion
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Package className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Netto Count</CardTitle>
          <CardDescription>
            Comptage de linge assisté par IA
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Connexion</TabsTrigger>
              <TabsTrigger value="signup">Inscription</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="vous@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="signin-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div id="recaptcha-signin" className="flex justify-center min-h-[78px]" />

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Se connecter
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nom complet</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Jean Dupont"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="vous@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Minimum 8 caractères</p>
                </div>

                <div id="recaptcha-signup" className="flex justify-center min-h-[78px]" />

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Créer un compte
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
