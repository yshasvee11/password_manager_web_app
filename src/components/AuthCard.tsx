import { useState } from 'react';
import { performSignupCryptoFlow } from '../auth/signup';
import { performLoginCryptoFlow } from '../auth/login';
import {
    firebaseGoogleLogin,
    firebaseEmailLogin,
    firebaseEmailSignup,
    saveVault,
    loadVault,
} from '../storage/vaultStorage';
import { isFirebaseConfigured } from '../firebase/config';
import { KeyRound, ShieldCheck, Mail, LogIn, Lock, CheckCircle2, UserPlus, AlertCircle, ArrowRight } from 'lucide-react';

function validatePasswordStrength(password: string) {
    if (password.length < 12) return 'Master password must be at least 12 characters.';
    if (!/[A-Z]/.test(password)) return 'Master password must contain at least one uppercase letter.';
    if (!/[a-z]/.test(password)) return 'Master password must contain at least one lowercase letter.';
    if (!/[0-9]/.test(password)) return 'Master password must contain at least one digit.';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Master password must contain at least one special character.';
    return null

type AuthStep = 'verify' | 'vault-choice' | 'unlock' | 'create';

export default function AuthCard({ onLoginSuccess, toast }: any) {
    const [step, setStep] = useState<AuthStep>('verify');
    const [authMode, setAuthMode] = useState<'google' | 'email-login' | 'email-signup'>('google');
    const [email, setEmail] = useState('');
    const [emailPass, setEmailPass] = useState('');
    const [googleUser, setGoogleUser] = useState<any>(null);
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState('Select an authentication method to continue.');

    const moveToVaultChoice = (user: any) => {
        setGoogleUser(user);
        setPassword('');
        setStep('vault-choice');
        setStatus('Account verified. Do you already have a vault for this account?');
    };

    const handleGoogleLogin = async () => {
        if (!isFirebaseConfigured) return setError('Firebase is not configured.');
        setLoading(true); setError(null); setStatus('Opening Google sign-in...');
        try {
            const cred = await firebaseGoogleLogin();
            moveToVaultChoice(cred.user);
        } catch (err: any) {
            setStatus(''); setError(err.message || 'Authentication failed.');
        } finally { setLoading(false); }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFirebaseConfigured) return setError('Firebase is not configured.');
        if (!email || !emailPass) return setError('Please enter both email and account password.');

        setLoading(true); setError(null); setStatus(authMode === 'email-login' ? 'Signing in...' : 'Creating account...');
        try {
            const cred = authMode === 'email-login'
                ? await firebaseEmailLogin(email, emailPass)
                : await firebaseEmailSignup(email, emailPass);
            if (authMode === 'email-signup') toast.success('Account created successfully!');
            moveToVaultChoice(cred.user);
        } catch (err: any) {
            setStatus(''); setError(err.message || 'Authentication failed.');
        } finally { setLoading(false); }
    };

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!googleUser) return setError('Please verify your account first.');
        const strengthError = validatePasswordStrength(password);
        if (strengthError) return setError(strengthError);

        setLoading(true); setError(null); setStatus('Unlocking encrypted vault...');
        try {
            const userId = googleUser.uid;
            const displayName = googleUser.displayName || googleUser.email || 'User';
            const firebaseData = await loadVault(userId);
            const decryptedVault = await performLoginCryptoFlow(password, firebaseData);
            onLoginSuccess({ userId, displayName }, decryptedVault, firebaseData);
        } catch (err: any) {
            if (err.code === 'vault/not-found') {
                setError('No vault found. Go back and choose "Create New Vault".');
            } else {
                setError(err.message || 'Unlock failed.');
            }
            setStatus('Enter your master password to unlock.');
        } finally { setLoading(false); }
    };

    const handleCreateVault = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!googleUser) return setError('Please verify your account first.');
        const strengthError = validatePasswordStrength(password);
        if (strengthError) return setError(strengthError);

        setLoading(true); setError(null); setStatus('Creating encrypted vault...');
        try {
            const userId = googleUser.uid;
            const displayName = googleUser.displayName || googleUser.email || 'User';

            try {
                await loadVault(userId);
                throw new Error('A vault already exists. Go back and choose "Unlock Existing Vault".');
            } catch (err: any) {
                if (err.code && err.code !== 'vault/not-found') throw err;
                const cryptoPayload = await performSignupCryptoFlow(password);
                await saveVault(userId, cryptoPayload);
                const firebaseData = await loadVault(userId);
                toast.success('New vault created for this account.');
                onLoginSuccess({ userId, displayName }, { items: [] }, firebaseData);
            }
        } catch (err: any) {
            setStatus('Enter your master password to create your vault.');
            setError(err.message || 'Creation failed.');
        } finally { setLoading(false); }
    };

    const isVerify = step === 'verify';

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-md mx-auto relative z-10 animate-fade-in">
            <div className="w-full bg-[#161b22]/70 backdrop-blur-xl border border-white/10 rounded-2xl p-8 sm:p-10 shadow-2xl">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shadow-[0_0_20px_rgba(88,166,255,0.2)]">
                        {isVerify ? <ShieldCheck size={32} /> : <Lock size={32} />}
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-center text-white mb-2 tracking-tight">
                    {step === 'verify' && 'Verify Account'}
                    {step === 'vault-choice' && 'Vault Setup'}
                    {step === 'unlock' && 'Unlock Existing Vault'}
                    {step === 'create' && 'Create New Vault'}
                </h2>

                <p className="text-sm text-center text-[#8b949e] mb-8 leading-relaxed">{status}</p>

                {error && (
                    <div className="flex items-start gap-3 bg-[#f85149]/10 border border-[#f85149]/20 text-[#f85149] text-sm p-4 rounded-xl mb-6 animate-fade-in">
                        <AlertCircle size={18} className="mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {step === 'verify' && (
                    <div className="space-y-6">
                        <div className="flex bg-[#0d1117]/80 rounded-lg p-1 border border-white/10">
                            <button onClick={() => setAuthMode('google')} className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${authMode === 'google' ? 'bg-white/10 text-white shadow' : 'text-[#8b949e] hover:text-white hover:bg-white/5'}`}>Google</button>
                            <button onClick={() => setAuthMode('email-login')} className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${authMode === 'email-login' ? 'bg-white/10 text-white shadow' : 'text-[#8b949e] hover:text-white hover:bg-white/5'}`}>Email Login</button>
                            <button onClick={() => setAuthMode('email-signup')} className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${authMode === 'email-signup' ? 'bg-white/10 text-white shadow' : 'text-[#8b949e] hover:text-white hover:bg-white/5'}`}>Email Sign Up</button>
                        </div>

                        {authMode === 'google' ? (
                            <button type="button" className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-primary text-white font-medium rounded-xl hover:bg-[#3182ce] active:scale-[0.98] transition-all disabled:opacity-60 shadow-md hover:shadow-[0_0_15px_rgba(88,166,255,0.4)] border border-primary/50" onClick={handleGoogleLogin} disabled={loading}>
                                <Mail size={18} />
                                {loading ? 'Working...' : 'Continue with Google'}
                            </button>
                        ) : (
                            <form onSubmit={handleEmailAuth} className="space-y-4">
                                <input type="email" placeholder="Email Address" className="w-full px-4 py-3 bg-[#0d1117]/80 border border-white/10 rounded-xl text-white placeholder-[#8b949e] focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all text-sm" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} />
                                <input type="password" placeholder="Account Password (NOT Master Password)" className="w-full px-4 py-3 bg-[#0d1117]/80 border border-white/10 rounded-xl text-white placeholder-[#8b949e] focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all text-sm" value={emailPass} onChange={e => setEmailPass(e.target.value)} disabled={loading} />
                                <button type="submit" className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-primary text-white font-medium rounded-xl hover:bg-[#3182ce] active:scale-[0.98] transition-all disabled:opacity-60 shadow-md hover:shadow-[0_0_15px_rgba(88,166,255,0.4)] border border-primary/50" disabled={loading}>
                                    {authMode === 'email-login' ? <LogIn size={18} /> : <UserPlus size={18} />}
                                    {loading ? 'Working...' : (authMode === 'email-login' ? 'Sign In' : 'Create Account')}
                                </button>
                            </form>
                        )}
                    </div>
                )}

                {step === 'vault-choice' && (
                    <div className="space-y-3">
                        <button type="button" onClick={() => { setError(null); setPassword(''); setStep('unlock'); setStatus('Enter your Master Password to unlock your existing vault.'); }} className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-primary text-white font-medium rounded-xl hover:bg-[#3182ce] transition-all border border-primary/50">
                            <ArrowRight size={18} /> Unlock Existing Vault
                        </button>
                        <button type="button" onClick={() => { setError(null); setPassword(''); setStep('create'); setStatus('Create a strong Master Password for your new vault.'); }} className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-white/5 text-[#c9d1d9] border border-white/10 font-medium rounded-xl hover:bg-white/10 hover:border-white/20 transition-all">
                            <UserPlus size={18} className="text-[#8b949e]" /> Create New Vault
                        </button>
                    </div>
                )}

                {step === 'unlock' && (
                    <form onSubmit={handleUnlock} autoComplete="off" className="space-y-5">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#8b949e] group-focus-within:text-primary transition-colors"><KeyRound size={18} /></div>
                            <input type="password" placeholder="Master Password" className="w-full pl-11 pr-4 py-3.5 bg-[#0d1117]/80 border border-white/10 rounded-xl text-white placeholder-[#8b949e] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-base" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} autoFocus />
                        </div>
                        <div className="space-y-3 pt-2">
                            <button type="submit" className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-primary text-white font-medium rounded-xl hover:bg-[#3182ce] transition-all disabled:opacity-60 border border-primary/50" disabled={loading}>
                                <ArrowRight size={18} /> {loading ? 'Working...' : 'Unlock Vault'}
                            </button>
                            <button type="button" onClick={() => { setError(null); setStep('vault-choice'); setStatus('Account verified. Do you already have a vault for this account?'); }} className="w-full py-3 px-4 bg-white/5 text-[#c9d1d9] border border-white/10 rounded-xl hover:bg-white/10 transition-all">
                                Back
                            </button>
                        </div>
                    </form>
                )}

                {step === 'create' && (
                    <form onSubmit={handleCreateVault} autoComplete="off" className="space-y-5">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#8b949e] group-focus-within:text-primary transition-colors"><KeyRound size={18} /></div>
                            <input type="password" placeholder="New Master Password" className="w-full pl-11 pr-4 py-3.5 bg-[#0d1117]/80 border border-white/10 rounded-xl text-white placeholder-[#8b949e] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-base" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} autoFocus />
                        </div>
                        <div className="space-y-3 pt-2">
                            <button type="submit" className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-primary text-white font-medium rounded-xl hover:bg-[#3182ce] transition-all disabled:opacity-60 border border-primary/50" disabled={loading}>
                                <UserPlus size={18} /> {loading ? 'Working...' : 'Create Vault'}
                            </button>
                            <button type="button" onClick={() => { setError(null); setStep('vault-choice'); setStatus('Account verified. Do you already have a vault for this account?'); }} className="w-full py-3 px-4 bg-white/5 text-[#c9d1d9] border border-white/10 rounded-xl hover:bg-white/10 transition-all">
                                Back
                            </button>
                        </div>
                    </form>
                )}
            </div>

            <div className="mt-8 text-center text-xs text-[#8b949e]/60 flex items-center justify-center gap-2">
                <CheckCircle2 size={12} />
                <span>Zero-knowledge client-side encryption</span>
            </div>
        </div>
    );
}
