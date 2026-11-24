// signin form
import React, { useState, useEffect } from 'react';
import { NativeOnly } from './NativeOnly';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import {
  Shield,
  Eye,
  EyeOff,
  Fingerprint,
  Lock,
  CheckCircle2,
  Key,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  User,
} from 'lucide-react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { ratoDb } from '../services/ratoDb';
import { securityService, BiometricStatus, SavedUserSession } from '../services/securityService';
import { PinKeypadModal } from './PinKeypadModal';

interface SignInScreenProps {
  onSignInSuccess: () => void;
  onNavigateToSignUp: () => void;
  onForgotPassword: (identifier?: string) => void;
  initialEmail?: string;
}

export const SignInScreen: React.FC<SignInScreenProps> = ({
  onSignInSuccess,
  onNavigateToSignUp,
  onForgotPassword,
  initialEmail = '',
}) => {
  const [identifier, setIdentifier] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isAuthenticatingBio, setIsAuthenticatingBio] = useState(false);
  const [bioSuccess, setBioSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [mpinSuccessMsg, setMpinSuccessMsg] = useState<string | null>(null);
  const [bioStatus, setBioStatus] = useState<BiometricStatus | null>(null);
  const [savedSession, setSavedSession] = useState<SavedUserSession | null>(null);

  const [showMpinModal, setShowMpinModal] = useState(false);
  const [mpinMode, setMpinMode] = useState<'verify' | 'setup'>('verify');

  useEffect(() => {
    (async () => {
      const status = await securityService.checkBiometrics();
      setBioStatus(status);
      const session = await securityService.getSavedUserSession();
      setSavedSession(session);
      if (session?.email && !identifier) {
        setIdentifier(session.email);
      }
    })();
  }, []);

  const handleFormSubmit = async () => {
    if (!identifier.trim()) {
      setErrorMsg('Please enter your email or phone number');
      return;
    }
    if (!password.trim()) {
      setErrorMsg('Please enter your password');
      return;
    }
    setErrorMsg('');
    setMpinSuccessMsg(null);
    setIsSigningIn(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, identifier.trim(), password);
      const profile = await ratoDb.ensureUserProfile(
        cred.user.uid,
        cred.user.email || identifier,
        cred.user.displayName,
        cred.user.photoURL
      );
      await securityService.saveUserSession({
        uid: cred.user.uid,
        email: cred.user.email || identifier.trim(),
        password: password,
        displayName: `${profile.firstName} ${profile.lastName}`.trim() || undefined,
        accountNumber: profile.accountNumber,
      });
      await securityService.saveCachedProfile(profile);
      setIsSigningIn(false);
      onSignInSuccess();
    } catch (err: any) {
      setIsSigningIn(false);
      let msg = 'Invalid email or password';
      if (err.code === 'auth/user-not-found') {
        msg = 'No account found with this email. Please tap "Create account" below to register.';
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Incorrect email or password. Please verify your credentials.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Invalid email address format.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many failed login attempts. Please wait a moment and try again.';
      }
      setErrorMsg(msg);
    }
  };

  const handleBiometricSignIn = async () => {
    setErrorMsg('');
    setMpinSuccessMsg(null);

    const session = await securityService.getSavedUserSession();
    if (!session || !session.email) {
      setErrorMsg('No linked account found on this device. Please sign in with your email and password first to enable biometrics.');
      return;
    }

    setIsAuthenticatingBio(true);

    try {
      const bioRes = await securityService.authenticateBiometrics(
        `Sign in to Rato Pay as ${session.displayName || session.email}`
      );

      if (!bioRes.success) {
        setIsAuthenticatingBio(false);
        if (bioRes.error !== 'Authentication cancelled') {
          setErrorMsg(bioRes.error || 'Biometric authentication failed. Please enter Bank MPIN.');
          setMpinMode('verify');
          setShowMpinModal(true);
        }
        return;
      }

      setBioSuccess(true);

      const cred = await signInWithEmailAndPassword(auth, session.email, session.password || '');

      const profile = await ratoDb.ensureUserProfile(
        cred.user.uid,
        cred.user.email || session.email,
        session.displayName || 'User'
      );

      await securityService.saveCachedProfile(profile);

      setIsAuthenticatingBio(false);
      onSignInSuccess();
    } catch (err: any) {
      setIsAuthenticatingBio(false);
      setBioSuccess(false);
      let msg = err.message?.replace('Firebase: ', '') || 'Biometric sign-in failed';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        msg = 'Session expired or password changed. Please sign in with your password.';
      }
      setErrorMsg(msg);
    }
  };

  const handleMpinSuccess = async () => {
    setShowMpinModal(false);
    if (mpinMode === 'setup') {
      setMpinSuccessMsg('4-Digit Bank MPIN created successfully! You can now use it for instant login & transfers.');
      return;
    }

    setIsSigningIn(true);
    setErrorMsg('');
    setMpinSuccessMsg(null);
    try {
      const session = await securityService.getSavedUserSession();
      if (!session || !session.email) {
        setIsSigningIn(false);
        setErrorMsg('No linked account found on this device. Please sign in with your email and password first.');
        return;
      }

      const cred = await signInWithEmailAndPassword(auth, session.email, session.password || '');

      const profile = await ratoDb.ensureUserProfile(
        cred.user.uid,
        cred.user.email || session.email,
        session.displayName || 'User'
      );

      await securityService.saveCachedProfile(profile);

      setIsSigningIn(false);
      onSignInSuccess();
    } catch (err: any) {
      setIsSigningIn(false);
      let msg = err.message?.replace('Firebase: ', '') || 'Bank MPIN sign-in failed';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        msg = 'Session expired or password changed. Please sign in with your password.';
      }
      setErrorMsg(msg);
    }
  };

  const handleOpenMpinLogin = async () => {
    setErrorMsg('');
    setMpinSuccessMsg(null);
    const session = await securityService.getSavedUserSession();
    if (!session || !session.email) {
      setErrorMsg('No linked account found on this device. Please sign in with your email and password first.');
      return;
    }
    setMpinMode('verify');
    setShowMpinModal(true);
  };

  const handleOpenCreateMpin = async () => {
    setErrorMsg('');
    setMpinSuccessMsg(null);
    const session = await securityService.getSavedUserSession();
    if (!session || !session.email) {
      setErrorMsg('Please sign in with your email and password first to set up your Bank MPIN.');
      return;
    }
    setMpinMode('setup');
    setShowMpinModal(true);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.inner}>
        {}
        <View style={styles.iconContainer}>
          <View style={styles.iconBox}>
            <Shield size={28} color="#dc2626" strokeWidth={2.2} />
          </View>
        </View>

        {}
        <View style={styles.headingContainer}>
          <Text style={styles.heading}>Welcome back</Text>
          <Text style={styles.subheading}>Sign in to access your Rato Pay account</Text>
        </View>

        {}
        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tab, styles.tabActive]} activeOpacity={1}>
            <Text style={styles.tabActiveText}>Sign in</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tab} onPress={onNavigateToSignUp} activeOpacity={0.7}>
            <Text style={styles.tabInactiveText}>Create account</Text>
          </TouchableOpacity>
        </View>

        {}
        {savedSession ? (
          <View style={styles.savedUserCard}>
            <View style={styles.savedUserAvatar}>
              <User size={18} color="#dc2626" />
            </View>
            <View style={styles.savedUserInfo}>
              <Text style={styles.savedUserLabel}>ENROLLED ON THIS DEVICE</Text>
              <Text style={styles.savedUserName}>{savedSession.displayName || 'Personal Account'}</Text>
              <Text style={styles.savedUserEmail}>{savedSession.email}</Text>
            </View>
            <TouchableOpacity
              style={styles.switchAccountBtn}
              onPress={async () => {
                await securityService.clearUserSession();
                await securityService.clearCachedProfile();
                setSavedSession(null);
                setIdentifier('');
                setPassword('');
              }}
            >
              <Text style={styles.switchAccountText}>Switch</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {}
        {errorMsg ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {}
        {mpinSuccessMsg ? (
          <View style={styles.successBox}>
            <CheckCircle2 size={16} color="#16a34a" />
            <Text style={styles.successText}>{mpinSuccessMsg}</Text>
          </View>
        ) : null}

        {}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Email or Phone</Text>
          <TextInput
            style={styles.input}
            placeholder="name@example.com"
            placeholderTextColor="#94a3b8"
            value={identifier}
            onChangeText={setIdentifier}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.fieldLabel}>Password</Text>
            <TouchableOpacity onPress={() => onForgotPassword(identifier.trim())}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Enter your password"
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
              {showPassword ? <EyeOff size={20} color="#dc2626" /> : <Eye size={20} color="#64748b" />}
            </TouchableOpacity>
          </View>
        </View>

        {}
        <TouchableOpacity
          style={[styles.primaryBtn, isSigningIn && styles.btnDisabled]}
          onPress={handleFormSubmit}
          disabled={isSigningIn}
          activeOpacity={0.9}
        >
          {isSigningIn ? (
            <View style={styles.btnRow}>
              <ActivityIndicator size="small" color="#ffffff" />
              <Text style={styles.primaryBtnText}>Signing in...</Text>
            </View>
          ) : (
            <Text style={styles.primaryBtnText}>Sign in with Password</Text>
          )}
        </TouchableOpacity>

        {}
        <NativeOnly>
        {}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR QUICK BANKING ACCESS</Text>
          <View style={styles.dividerLine} />
        </View>

        {}
        <View style={styles.quickSecurityRow}>
          {}
          <TouchableOpacity
            style={styles.securityOptionBtn}
            onPress={handleOpenMpinLogin}
            activeOpacity={0.85}
          >
            <View style={styles.securityIconBoxRed}>
              <Key size={18} color="#dc2626" />
            </View>
            <View style={styles.securityTextCol}>
              <Text style={styles.securityBtnTitle}>Bank MPIN</Text>
              <Text style={styles.securityBtnSub}>4-digit quick sign in</Text>
            </View>
          </TouchableOpacity>

          {}
          <TouchableOpacity
            style={styles.securityOptionBtn}
            onPress={handleBiometricSignIn}
            disabled={isAuthenticatingBio}
            activeOpacity={0.85}
          >
            <View style={styles.securityIconBoxDark}>
              {isAuthenticatingBio ? (
                <ActivityIndicator size="small" color="#09090b" />
              ) : bioSuccess ? (
                <CheckCircle2 size={18} color="#16a34a" />
              ) : (
                <Fingerprint size={18} color="#09090b" />
              )}
            </View>
            <View style={styles.securityTextCol}>
              <Text style={styles.securityBtnTitle}>
                {bioStatus?.biometricType === 'Face ID' ? 'Face ID' : 'Biometrics'}
              </Text>
              <Text style={styles.securityBtnSub}>1-tap instant unlock</Text>
            </View>
          </TouchableOpacity>
        </View>

        {}
        <TouchableOpacity
          style={styles.createMpinCard}
          onPress={handleOpenCreateMpin}
          activeOpacity={0.85}
        >
          <View style={styles.createMpinLeft}>
            <View style={styles.shieldGreenCircle}>
              <ShieldCheck size={18} color="#16a34a" />
            </View>
            <View style={styles.createMpinTextWrap}>
              <Text style={styles.createMpinTitle}>Create / Set Bank MPIN</Text>
              <Text style={styles.createMpinSub}>
                Set 4-digit PIN for instant banking & transfers
              </Text>
            </View>
          </View>
          <ArrowRight size={16} color="#71717a" />
        </TouchableOpacity>
        </NativeOnly>

        {}
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <TouchableOpacity onPress={onNavigateToSignUp}>
            <Text style={styles.signUpLink}> Create account</Text>
          </TouchableOpacity>
        </View>

        {}
        <View style={styles.trustNote}>
          <Lock size={14} color="#94a3b8" />
          <Text style={styles.trustText}>Protected with 256-bit encryption</Text>
        </View>
      </View>

      {}
      <PinKeypadModal
        isOpen={showMpinModal}
        onClose={() => setShowMpinModal(false)}
        onSuccess={handleMpinSuccess}
        mode={mpinMode}
        title={mpinMode === 'setup' ? 'Create Bank MPIN' : 'Sign in with Bank MPIN'}
        subtitle={
          mpinMode === 'setup'
            ? 'Set a 4-digit PIN for fast sign-in and transfer approval'
            : `Enter 4-digit PIN for ${savedSession?.displayName || savedSession?.email || 'your account'}`
        }
        showBiometricOption={mpinMode === 'verify'}
        onUseBiometric={async () => {
          setShowMpinModal(false);
          await handleBiometricSignIn();
        }}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 28,
  },
  inner: {
    width: '100%',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0a0a0c',
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 6,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e4e4e7',
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingBottom: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#dc2626',
  },
  tabActiveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
  },
  tabInactiveText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#09090b',
    marginBottom: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  forgotText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '600',
  },
  input: {
    width: '100%',
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    backgroundColor: '#fafafa',
    color: '#09090b',
    fontSize: 14,
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e4e4e7',
    backgroundColor: '#fafafa',
    borderRadius: 8,
  },
  passwordInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: 14,
    color: '#09090b',
    fontSize: 14,
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryBtn: {
    height: 48,
    backgroundColor: '#dc2626',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  btnDisabled: {
    opacity: 0.8,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },

  bioBtn: {
    height: 44,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bioBtnText: {
    color: '#0a0a0c',
    fontSize: 13,
    fontWeight: '600',
  },
  bioSuccessText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '700',
  },
  bioAuthenticatingText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '700',
  },
  savedUserCard: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  savedUserAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffe4e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedUserInfo: {
    flex: 1,
  },
  savedUserLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#e11d48',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  savedUserName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#881337',
  },
  savedUserEmail: {
    fontSize: 11,
    color: '#9f1239',
  },
  switchAccountBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  switchAccountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#e11d48',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 13,
    color: '#64748b',
  },
  signUpLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#dc2626',
  },
  trustNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
  },
  trustText: {
    fontSize: 11,
    color: '#64748b',
  },
  successBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  successText: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e4e4e7',
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#71717a',
    letterSpacing: 0.8,
  },
  quickSecurityRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  securityOptionBtn: {
    flex: 1,
    height: 56,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e4e4e7',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  securityIconBoxRed: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityIconBoxDark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#f4f4f5',
    borderWidth: 1,
    borderColor: '#e4e4e7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityTextCol: {
    flex: 1,
  },
  securityBtnTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#09090b',
  },
  securityBtnSub: {
    fontSize: 10,
    color: '#71717a',
    marginTop: 1,
  },
  createMpinCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  createMpinLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  shieldGreenCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createMpinTextWrap: {
    flex: 1,
  },
  createMpinTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  createMpinSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
});

