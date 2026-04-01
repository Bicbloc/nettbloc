import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, CheckCircle, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";

export default function ActivateAccount() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialCode = useMemo(() => searchParams.get("code")?.trim().toUpperCase() || "", [searchParams]);

  const [activationCode, setActivationCode] = useState(initialCode);
  const [isLoading, setIsLoading] = useState(Boolean(initialCode));
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<any>(null);
  const [subAccount, setSubAccount] = useState<any>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!initialCode) {
      setIsLoading(false);
      return;
    }

    void validateCode(initialCode);
  }, [initialCode]);

  const validateCode = async (rawCode: string) => {
    const invitationCode = rawCode.trim().toUpperCase();

    if (!invitationCode) {
      setError("Veuillez saisir le code reçu par email");
      setInvitation(null);
      setSubAccount(null);
      return false;
    }

    setIsValidatingCode(true);
    setIsLoading(true);
    setError(null);

    try {
      const { data: invitationData, error: invitationError } = await supabase
        .from("sub_account_invitations")
        .select("*, sub_accounts(*, hotels(id, name, hotel_code))")
        .eq("invitation_code", invitationCode)
        .single();

      if (invitationError || !invitationData) {
        setInvitation(null);
        setSubAccount(null);
        setError("Code d'invitation invalide ou expiré");
        return false;
      }

      if (invitationData.status === "accepted" || invitationData.accepted_at) {
        setInvitation(null);
        setSubAccount(null);
        setError("Ce compte a déjà été activé");
        return false;
      }

      if (invitationData.expires_at && new Date(invitationData.expires_at) < new Date()) {
        setInvitation(null);
        setSubAccount(null);
        setError("Ce code d'invitation a expiré");
        return false;
      }

      setActivationCode(invitationCode);
      setInvitation(invitationData);
      setSubAccount(invitationData.sub_accounts);
      setEmail(invitationData.sub_accounts?.email || "");
      setError(null);
      return true;
    } catch (err) {
      console.error("Error validating code:", err);
      setInvitation(null);
      setSubAccount(null);
      setError("Erreur lors de la validation du code");
      return false;
    } finally {
      setIsLoading(false);
      setIsValidatingCode(false);
    }
  };

  const resolveAuthUserId = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const { data: sessionData } = await supabase.auth.getSession();
    const currentUser = sessionData.session?.user;

    if (currentUser?.email?.toLowerCase() === normalizedEmail) {
      return currentUser.id;
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: subAccount?.first_name,
          last_name: subAccount?.last_name,
          is_sub_account: true,
          company_name: subAccount?.hotels?.name || null,
        },
      },
    });

    if (signUpError) {
      const signUpMessage = signUpError.message.toLowerCase();
      const accountAlreadyExists =
        signUpMessage.includes("already") ||
        signUpMessage.includes("registered") ||
        signUpMessage.includes("exists") ||
        signUpMessage.includes("utilisé");

      if (!accountAlreadyExists) {
        throw signUpError;
      }

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError || !signInData.user) {
        throw new Error("Ce compte existe déjà. Connectez-vous avec le mot de passe défini puis relancez l'activation.");
      }

      return signInData.user.id;
    }

    if (!signUpData.user) {
      throw new Error("Échec de la création du compte");
    }

    return signUpData.user.id;
  };

  const callActivateSubAccount = async (userId: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/activate-subaccount`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        invitationCode: activationCode,
        userId,
      }),
    });

    const responseText = await response.text();
    let payload: any = null;

    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch {
      payload = responseText ? { error: responseText } : null;
    }

    if (!response.ok) {
      throw new Error(payload?.error || "Erreur lors de l'activation du sous-compte");
    }

    return payload;
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!activationCode.trim()) {
      toast.error("Veuillez saisir votre code d'invitation");
      return;
    }

    if (!subAccount?.id) {
      toast.error("Veuillez d'abord valider votre code d'invitation");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }

    if (password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    setIsActivating(true);
    setError(null);

    try {
      localStorage.removeItem("nettbloc_hotel");
      localStorage.removeItem("nettbloc-hotel");
      localStorage.removeItem("nettobloc_hotel_session");
      localStorage.removeItem("selectedHotelId");

      const userId = await resolveAuthUserId();
      await callActivateSubAccount(userId);

      const { data: sessionAfterActivation } = await supabase.auth.getSession();
      const activatedUser = sessionAfterActivation.session?.user;

      if (activatedUser?.email?.toLowerCase() !== email.toLowerCase()) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          console.warn("Auto sign-in after activation failed:", signInError.message);
        }
      }

      toast.success("Compte activé avec succès !");

      setTimeout(() => {
        navigate("/auth/establishment");
      }, 1200);
    } catch (err: any) {
      console.error("Activation error:", err);
      const message = err?.message || "Erreur lors de l'activation";
      setError(message);
      toast.error(message);
    } finally {
      setIsActivating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!invitation || !subAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center space-y-3">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <KeyRound className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Activer un sous-compte</CardTitle>
            <CardDescription>
              Collez ici le code reçu par email pour continuer l'activation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="activation-code">Code d'invitation</Label>
              <Input
                id="activation-code"
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                placeholder="Ex: AB12CD34"
                autoCapitalize="characters"
                autoCorrect="off"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              className="w-full"
              onClick={() => void validateCode(activationCode)}
              disabled={isValidatingCode || !activationCode.trim()}
            >
              {isValidatingCode ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Vérification...
                </>
              ) : (
                "Continuer"
              )}
            </Button>

            <Button variant="ghost" className="w-full" onClick={() => navigate("/auth/establishment")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Retour à la connexion
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Activez votre compte</CardTitle>
          <CardDescription>
            Bienvenue {subAccount?.first_name} ! Créez votre mot de passe pour accéder à{" "}
            <strong>{subAccount?.hotels?.name || "NettBloc"}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleActivate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="validated-code">Code d'invitation</Label>
              <Input id="validated-code" value={activationCode} disabled className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} disabled className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 caractères"
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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Répétez votre mot de passe"
                required
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isActivating}>
              {isActivating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Activation...
                </>
              ) : (
                "Activer mon compte"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
