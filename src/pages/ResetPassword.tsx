import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

type Step = "checking" | "ready" | "invalid" | "success";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language } = useTranslation();

  const [step, setStep] = useState<Step>("checking");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFrench = language !== "en";

  const ui = useMemo(
    () => ({
      title: isFrench ? "Réinitialiser le mot de passe" : "Reset password",
      subtitle: isFrench
        ? "Choisissez un nouveau mot de passe puis validez."
        : "Choose a new password and confirm.",
      newPassword: isFrench ? "Nouveau mot de passe" : "New password",
      confirmPassword: isFrench ? "Confirmer le mot de passe" : "Confirm password",
      submit: isFrench ? "Valider" : "Confirm",
      backToLogin: isFrench ? "Retour à la connexion" : "Back to login",
      invalidTitle: isFrench ? "Lien invalide ou expiré" : "Link invalid or expired",
      invalidDesc: isFrench
        ? "Demandez un nouveau lien de réinitialisation."
        : "Please request a new password reset link.",
      updatedTitle: isFrench ? "Mot de passe mis à jour" : "Password updated",
      updatedDesc: isFrench
        ? "Vous pouvez maintenant vous connecter avec votre nouveau mot de passe."
        : "You can now sign in with your new password.",
    }),
    [isFrench]
  );

  useEffect(() => {
    const run = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "");

      const code = searchParams.get("code");
      const type = hashParams.get("type") ?? searchParams.get("type");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      // 1) Implicit format: #access_token=...&refresh_token=...&type=recovery
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error("Reset password: setSession error", error);
          setStep("invalid");
          return;
        }

        // Clean URL (avoid leaking tokens)
        window.history.replaceState({}, document.title, "/reset-password");
        setStep("ready");
        return;
      }

      // 2) PKCE format: ?code=... (may fail if code_verifier missing)
      if (code) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("Reset password: exchangeCodeForSession error", error);
            // Don't immediately fail - check if session was set anyway
            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData.session) {
              window.history.replaceState({}, document.title, "/reset-password");
              setStep("ready");
              return;
            }
            setStep("invalid");
            return;
          }
          window.history.replaceState({}, document.title, "/reset-password");
          setStep("ready");
          return;
        } catch (e) {
          console.error("Reset password: code exchange exception", e);
          // Check session as fallback
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session) {
            window.history.replaceState({}, document.title, "/reset-password");
            setStep("ready");
            return;
          }
          setStep("invalid");
          return;
        }
      }

      // 3) Check for existing session (user may already be logged in from the link)
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setStep("ready");
        return;
      }

      // 4) Listen for auth state change (Supabase may auto-detect the token)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
          window.history.replaceState({}, document.title, "/reset-password");
          setStep("ready");
        }
      });

      // Wait a moment for potential auto-detection
      setTimeout(async () => {
        const { data: checkData } = await supabase.auth.getSession();
        if (checkData.session) {
          setStep("ready");
        } else if (step === "checking") {
          setStep("invalid");
        }
        subscription.unsubscribe();
      }, 2000);
    };

    void run();
  }, []);

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({
        variant: "destructive",
        title: isFrench ? "Mot de passe trop court" : "Password too short",
        description: isFrench ? "Minimum 6 caractères." : "At least 6 characters.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: isFrench ? "Les mots de passe ne correspondent pas" : "Passwords don't match",
        description: isFrench
          ? "Vérifiez que les deux mots de passe sont identiques."
          : "Please ensure both passwords are identical.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast({
        title: ui.updatedTitle,
        description: ui.updatedDesc,
      });
      setStep("success");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: isFrench ? "Erreur" : "Error",
        description: e?.message ?? String(e),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>{ui.title}</CardTitle>
            <CardDescription>{ui.subtitle}</CardDescription>
          </CardHeader>
          <CardContent>
            {step === "checking" && (
              <p className="text-sm text-muted-foreground">
                {isFrench ? "Vérification du lien..." : "Checking link..."}
              </p>
            )}

            {step === "invalid" && (
              <div className="space-y-4">
                <div>
                  <p className="font-medium">{ui.invalidTitle}</p>
                  <p className="text-sm text-muted-foreground">{ui.invalidDesc}</p>
                </div>
                <Button onClick={() => navigate("/auth")} className="w-full">
                  {ui.backToLogin}
                </Button>
              </div>
            )}

            {step === "success" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{ui.updatedDesc}</p>
                <Button onClick={() => navigate("/auth")} className="w-full">
                  {ui.backToLogin}
                </Button>
              </div>
            )}

            {step === "ready" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">{ui.newPassword}</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{ui.confirmPassword}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
                <Button onClick={handleUpdatePassword} className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (isFrench ? "Mise à jour..." : "Updating...") : ui.submit}
                </Button>
                <Button variant="ghost" onClick={() => navigate("/auth")} className="w-full">
                  {ui.backToLogin}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
