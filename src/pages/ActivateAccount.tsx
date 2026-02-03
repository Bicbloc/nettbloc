import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";

export default function ActivateAccount() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get("code");

  const [isLoading, setIsLoading] = useState(true);
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<any>(null);
  const [subAccount, setSubAccount] = useState<any>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (code) {
      validateCode(code);
    } else {
      setError("Code d'activation manquant");
      setIsLoading(false);
    }
  }, [code]);

  const validateCode = async (invitationCode: string) => {
    try {
      // Find invitation with this code in sub_account_invitations table
      const { data: invitationData, error: invitationError } = await supabase
        .from("sub_account_invitations")
        .select("*, sub_accounts(*, hotels(name))")
        .eq("invitation_code", invitationCode)
        .single();

      if (invitationError || !invitationData) {
        console.error("Invitation lookup error:", invitationError);
        setError("Code d'invitation invalide ou expiré");
        setIsLoading(false);
        return;
      }

      // Check if already accepted
      if (invitationData.status === "accepted" || invitationData.accepted_at) {
        setError("Ce compte a déjà été activé");
        setIsLoading(false);
        return;
      }

      // Check expiration
      if (invitationData.expires_at && new Date(invitationData.expires_at) < new Date()) {
        setError("Ce code d'invitation a expiré");
        setIsLoading(false);
        return;
      }

      setInvitation(invitationData);
      setSubAccount(invitationData.sub_accounts);
      setEmail(invitationData.sub_accounts?.email || "");
      setIsLoading(false);
    } catch (err) {
      console.error("Error validating code:", err);
      setError("Erreur lors de la validation du code");
      setIsLoading(false);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }

    if (password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    setIsActivating(true);

    try {
      // Create Supabase auth user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: subAccount.first_name,
            last_name: subAccount.last_name,
          },
        },
      });

      if (signUpError) {
        // If user already exists, try to sign in
        if (signUpError.message.includes("already registered")) {
          toast.error("Cet email est déjà utilisé. Essayez de vous connecter.");
          setIsActivating(false);
          return;
        }
        throw signUpError;
      }

      if (!authData.user) {
        throw new Error("Échec de la création du compte");
      }

      // Update sub_account with user_id and mark as active
      const { error: updateError } = await supabase
        .from("sub_accounts")
        .update({
          user_id: authData.user.id,
          invitation_status: "active",
          is_active: true,
        })
        .eq("id", subAccount.id);

      if (updateError) {
        console.error("Error updating sub_account:", updateError);
      }

      // Mark invitation as accepted
      if (invitation?.id) {
        await supabase
          .from("sub_account_invitations")
          .update({
            status: "accepted",
            accepted_at: new Date().toISOString(),
          })
          .eq("id", invitation.id);
      }

      toast.success("Compte activé avec succès !");

      // Redirect to auth page
      setTimeout(() => {
        navigate("/auth/establishment");
      }, 2000);
    } catch (err: any) {
      console.error("Activation error:", err);
      toast.error(err.message || "Erreur lors de l'activation");
    } finally {
      setIsActivating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-red-600">Erreur</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/auth/establishment")} className="w-full">
              Retour à la connexion
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
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
