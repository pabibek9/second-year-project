// login page
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Lock,
  Mail,
  User,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DhakaStrip, SLOGAN_EN, SLOGAN_NE } from "@/components/sandbox/primitives";
import { auth } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
} from "firebase/auth";

import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Developer Sign In â€” RatoPay" },
      {
        name: "description",
        content: "Sign in to the RatoPay developer dashboard.",
      },
      { property: "og:title", content: "Developer Sign In â€” RatoPay" },
      {
        property: "og:description",
        content: "Developer authentication for the RatoPay.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading, setUser } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      void navigate({ to: "/" });
    }
  }, [authLoading, isAuthenticated, navigate]);

  const [showForgotPass, setShowForgotPass] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setForgotError("Please enter a valid developer email address.");
      return;
    }
    setForgotLoading(true);
    setForgotError(null);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setForgotSuccess(true);
    } catch (err: any) {
      if (err.code === "auth/user-not-found") {
        setForgotError("No registered developer account found with this email.");
      } else if (err.code === "auth/invalid-email") {
        setForgotError("Invalid email format. Please check your spelling.");
      } else if (err.code === "auth/too-many-requests") {
        setForgotError("Too many attempts. Please wait a moment and check your inbox.");
      } else {
        setForgotError(err.message?.replace("Firebase: ", "") || "Failed to send reset link.");
      }
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (isSignUp) {
        const registeredName = name.trim() || "Developer";
        let registeredUid = "";
        try {
          const userCredential = await createUserWithEmailAndPassword(
            auth,
            email.trim(),
            password.trim(),
          );
          registeredUid = userCredential.user.uid;
          await sendEmailVerification(userCredential.user, {
            url: "https://developers.bibekparajuli.tech",
            handleCodeInApp: false,
          });
          if (name.trim()) {
            await updateProfile(userCredential.user, { displayName: name.trim() });
          }
        } catch (firebaseErr: any) {
          if (firebaseErr.code === "auth/operation-not-allowed") {
            setError(
              "Email/Password provider is not enabled yet in your Firebase Console (bank-d08b2). Please enable it under Firebase -> Authentication -> Sign-in method.",
            );
            setLoading(false);
            return;
          }
          if (firebaseErr.code === "auth/email-already-in-use") {
            setError("An account with this email already exists. Please Sign In instead.");
            setLoading(false);
            return;
          }
          setError(firebaseErr.message?.replace("Firebase: ", "") || "Account creation failed.");
          setLoading(false);
          return;
        }

        void registeredUid;
        void registeredName;
        await signOut(auth).catch(() => undefined);
        setIsSignUp(false);
        setPassword("");
        setSuccessMsg(`Account created. We sent a verification link to ${email.trim()}. Open it, then sign in.`);
      } else {
        let signedInName = "Developer";
        let signedInUid = "";
        try {
          const userCredential = await signInWithEmailAndPassword(
            auth,
            email.trim(),
            password.trim(),
          );
          signedInUid = userCredential.user.uid;
          signedInName = userCredential.user.displayName || email.split("@")[0] || "Developer";
        } catch (firebaseErr: any) {
          if (firebaseErr.code === "auth/operation-not-allowed") {
            setError(
              "Email/Password provider is not enabled yet in your Firebase Console (bank-d08b2). Enable it under Firebase -> Authentication.",
            );
            setLoading(false);
            return;
          }
          if (
            firebaseErr.code === "auth/user-not-found" ||
            firebaseErr.code === "auth/wrong-password" ||
            firebaseErr.code === "auth/invalid-credential"
          ) {
            setError("Invalid email or password. Please try again or create an account.");
            setLoading(false);
            return;
          }
          setError(firebaseErr.message?.replace("Firebase: ", "") || "Authentication failed.");
          setLoading(false);
          return;
        }

        const signedInUser = auth.currentUser;
        if (signedInUser && !signedInUser.emailVerified) {
          await sendEmailVerification(signedInUser, {
            url: "https://developers.bibekparajuli.tech",
            handleCodeInApp: false,
          }).catch(() => undefined);
          await signOut(auth).catch(() => undefined); // not signed in until the email is verified
          setError(
            `Your email is not verified yet. We just sent a new link to ${email.trim()}. Open it, then sign in again.`,
          );
          setLoading(false);
          return;
        }
        setUser({
          uid: signedInUid,
          name: signedInName,
          email: email.trim(),
          role: "DEVELOPER",
          initials: signedInName.slice(0, 1).toUpperCase(),
        });

        void navigate({ to: "/" });
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <div className="absolute -right-16 -top-16 h-72 w-72 opacity-15">
          <DhakaStrip />
        </div>
        <div className="absolute -bottom-20 -left-20 h-96 w-96 opacity-10">
          <DhakaStrip />
        </div>

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3.5 py-1 text-xs font-semibold backdrop-blur-sm">
            <span className="size-2 rounded-full bg-emerald-300 animate-pulse" />
            <span>DEVELOPER DASHBOARD</span>
          </div>

          <h1 className="mt-8 font-display text-4xl font-bold tracking-tight text-white">
            RatoPay
          </h1>
          <p className="mt-3 text-base text-primary-foreground/80 leading-relaxed max-w-md">
            Take payments on your website, and send the money to any Rato Pay account.
          </p>
        </div>

        <ol className="relative z-10 space-y-3">
          {[
            ["1", "Add your website", "Give it a name and get your keys."],
            ["2", "Customers pay on it", "Card, QR or the Rato Pay app."],
            ["3", "Send the money on", "To your own Rato Pay account, in a few taps."],
          ].map(([n, title, text]) => (
            <li key={n} className="flex items-start gap-3 rounded-xl border border-primary-foreground/15 bg-primary-foreground/10 p-4 backdrop-blur-sm">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-primary">{n}</span>
              <div>
                <div className="text-sm font-semibold text-white">{title}</div>
                <p className="mt-0.5 text-xs text-primary-foreground/80">{text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="relative z-10">
          <p className="font-deva text-lg font-medium text-white">{SLOGAN_NE}</p>
          <p className="mt-0.5 text-xs text-primary-foreground/70">{SLOGAN_EN}</p>
        </div>
      </div>

      {}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-md space-y-6">
          {}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-deva text-lg font-semibold text-primary">à¤¨à¤®à¤¸à¥à¤¤à¥‡</span>
              <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-primary-dark">
                For developers
              </span>
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {showForgotPass
                ? "Reset your password"
                : isSignUp
                  ? "Create your account"
                  : "Sign in"}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {showForgotPass
                ? "Enter the email you signed up with and we will send you a reset link."
                : isSignUp
                  ? "Sign up to add your website and start taking payments."
                  : "Sign in to see your websites and payments."}
            </p>
          </div>

          {showForgotPass ? (
            
            <form onSubmit={handleForgotPassword} className="space-y-4">
              {forgotError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive-soft p-3.5 text-xs text-destructive">
                  {forgotError}
                </div>
              )}

              {forgotSuccess ? (
                <div className="rounded-xl border border-primary/30 bg-secondary p-4 space-y-3">
                  <div className="flex items-center gap-2 text-primary-dark font-semibold text-sm">
                    <CheckCircle2 className="size-4 shrink-0 text-primary" />
                    <span>Password Reset Link Sent!</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    We have dispatched a password reset email via Firebase to{" "}
                    <strong className="text-foreground">{forgotEmail}</strong>. Please check your
                    inbox (and spam folder), open the link to set your new password, then sign in.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => {
                      setShowForgotPass(false);
                      setForgotSuccess(false);
                      setEmail(forgotEmail);
                    }}
                  >
                    Return to Sign In
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="forgot-email"
                        type="email"
                        placeholder="you@company.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="pl-9 bg-card"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={forgotLoading} className="w-full gap-2 shadow-sm">
                    {forgotLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Sending Reset Link...
                      </>
                    ) : (
                      <>
                        Send Reset Link <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
                </>
              )}

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPass(false);
                    setForgotError(null);
                    setForgotSuccess(false);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline cursor-pointer"
                >
                  <ArrowLeft className="size-3.5" /> Back to Sign In
                </button>
              </div>
            </form>
          ) : (
            <>
              {}
              {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive-soft p-3.5 text-xs text-destructive">
                  {error}
                </div>
              )}

              {successMsg && (
                <div className="rounded-xl border border-primary/30 bg-secondary p-3.5 text-xs font-medium text-primary-dark flex items-center gap-2">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {}
              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Your name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="name"
                        placeholder="Your full name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-9 bg-card"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9 bg-card"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {!isSignUp && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotPass(true);
                          setForgotEmail(email || "");
                          setForgotError(null);
                          setForgotSuccess(false);
                        }}
                        className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 bg-card"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full gap-2 shadow-sm">
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Authenticating...
                    </>
                  ) : (
                    <>
                      {isSignUp ? "Create account" : "Sign in"}{" "}
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </form>

              {}
              <div className="text-center text-xs text-muted-foreground">
                {isSignUp ? (
                  <>
                    Already have a developer account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(false);
                        setError(null);
                      }}
                      className="font-semibold text-primary hover:underline cursor-pointer"
                    >
                      Sign In
                    </button>
                  </>
                ) : (
                  <>
                    New developer?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(true);
                        setError(null);
                      }}
                      className="font-semibold text-primary hover:underline cursor-pointer"
                    >
                      Create an account
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

