import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { authStore } from "@/lib/authStore";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface AuthPageProps {
  mode: "login" | "signup";
  onNavigate: (path: string) => void;
  onAuth: () => void;
}

export default function AuthPage({ mode, onNavigate, onAuth }: AuthPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const { toast } = useToast();

  const authMutation = useMutation({
    mutationFn: async () => {
      if (mode === "login") {
        return authStore.login(email, password);
      } else {
        return authStore.register(email, password, name);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      queryClient.invalidateQueries({ queryKey: ["company"] });
      toast({
        title: mode === "login" ? "Connexion réussie" : "Compte créé",
        description: mode === "login" ? "Bienvenue sur PlombPro" : "Bienvenue ! Votre essai gratuit de 14 jours commence.",
      });
      onAuth();
    },
    onError: (error: any) => {
      const msg = error?.message || "";
      let description = mode === "login" ? "Email ou mot de passe incorrect" : "Impossible de créer le compte";
      if (msg.includes("existe déjà") || msg.includes("already")) {
        description = "Un compte existe déjà avec cet email";
      }
      toast({
        title: "Erreur",
        description,
        variant: "destructive",
      });
    },
  });

  const googleAuthMutation = useMutation({
    mutationFn: async () => {
      // For now, Google auth opens a demo flow
      // In production, this would use Supabase OAuth
      toast({
        title: "Google OAuth",
        description: "La connexion Google sera disponible prochainement. Utilisez email/mot de passe.",
      });
      throw new Error("Google auth not yet configured");
    },
    onError: () => {
      // Silent - toast already shown
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs",
        variant: "destructive",
      });
      return;
    }
    if (password.length < 6) {
      toast({
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 6 caractères",
        variant: "destructive",
      });
      return;
    }
    authMutation.mutate();
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => onNavigate("landing")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="size-4" />
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 12V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1" />
                  <path d="M6 12h4" />
                  <path d="M10 12v6a2 2 0 0 0 2 2h0" />
                  <path d="M14 12V8a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v4" />
                  <path d="M14 12h4" />
                  <path d="M18 12v4a2 2 0 0 1-2 2h-4" />
                  <circle cx="12" cy="12" r="1" fill="currentColor" />
                </svg>
              </div>
              <span className="font-semibold text-foreground text-sm">PlombPro</span>
            </div>
          </button>
        </div>
      </header>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <Card>
            <CardHeader className="text-center pb-3">
              <CardTitle className="text-lg">
                {mode === "login" ? "Connexion" : "Créer un compte"}
              </CardTitle>
              <CardDescription className="text-sm">
                {mode === "login"
                  ? "Accédez à votre espace PlombPro"
                  : "14 jours d'essai gratuit, sans engagement"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Google Sign-In */}
              <Button
                variant="outline"
                className="w-full gap-3 h-10 mb-4 font-medium"
                onClick={() => googleAuthMutation.mutate()}
                disabled={googleAuthMutation.isPending}
                data-testid="btn-google-auth"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
                </svg>
                {mode === "login" ? "Continuer avec Google" : "S'inscrire avec Google"}
              </Button>

              <div className="relative my-4">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">ou</span>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                {mode === "signup" && (
                  <div>
                    <Label className="text-xs">Nom de l'entreprise</Label>
                    <div className="relative mt-1">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Ex: Martin Plomberie"
                        className="pl-9"
                        data-testid="input-auth-name"
                      />
                    </div>
                  </div>
                )}
                <div>
                  <Label className="text-xs">Email</Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="vous@entreprise.fr"
                      className="pl-9"
                      required
                      data-testid="input-auth-email"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Mot de passe</Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-9 pr-9"
                      required
                      minLength={6}
                      data-testid="input-auth-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-10 mt-2"
                  disabled={authMutation.isPending}
                  data-testid="btn-auth-submit"
                >
                  {authMutation.isPending
                    ? "Chargement..."
                    : mode === "login" ? "Se connecter" : "Créer mon compte"}
                </Button>
              </form>

              <div className="text-center mt-4 pt-4 border-t border-border/50">
                {mode === "login" ? (
                  <p className="text-sm text-muted-foreground">
                    Pas encore de compte ?{" "}
                    <button onClick={() => onNavigate("signup")} className="text-primary hover:underline font-medium" data-testid="link-switch-auth">
                      S'inscrire gratuitement
                    </button>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Déjà un compte ?{" "}
                    <button onClick={() => onNavigate("login")} className="text-primary hover:underline font-medium" data-testid="link-switch-auth">
                      Se connecter
                    </button>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
