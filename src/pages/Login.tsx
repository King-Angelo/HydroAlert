import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { signUpWithEmail, loginWithEmail, signInWithGoogle, resetPassword, db, handleFirestoreError, OperationType, signOut } from '../lib/firebase';
import { Droplet, ShieldAlert, Mail, Eye, EyeOff, User, Phone, LogOut } from 'lucide-react';
import { WaveBackground } from '../components/WaveBackground';
import { doc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';

export const Login: React.FC = () => {
  const { user, role, userData } = useAuth();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isCompletingProfile, setIsCompletingProfile] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [systemState, setSystemState] = useState<any>(null);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubState = onSnapshot(doc(db, 'systemState', 'current'), (snapshot) => {
      if (snapshot.exists()) {
        setSystemState(snapshot.data());
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'systemState/current'));

    return () => unsubState();
  }, []);

  const floodState = systemState 
    ? (systemState.waterLevel >= systemState.dangerThreshold ? 'danger' : 
       systemState.waterLevel >= systemState.warningThreshold ? 'warning' : 'normal')
    : 'normal';

  const waveLevel = systemState 
    ? (systemState.waterLevel / systemState.dangerThreshold) * 80 
    : 30;

  useEffect(() => {
    if (user && role !== 'admin') {
      if (userData && (!userData.name || !userData.phone)) {
        setIsCompletingProfile(true);
      } else if (userData) {
        setIsCompletingProfile(false);
      }
    } else {
      setIsCompletingProfile(false);
    }
  }, [user, role, userData]);

  const validatePhone = (p: string) => /^\d{10,15}$/.test(p.replace(/[\s\-\+]/g, ''));

  const getAuthErrorMessage = (err: any) => {
    const code = err?.code || '';
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Invalid email or password. If you signed up with Google, use Continue with Google or reset your password below.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a few minutes and try again.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      default:
        return err?.message || 'Authentication failed';
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword(email);
      setMessage('Password reset email sent. Check your inbox and spam folder.');
      setIsForgotPassword(false);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/user-not-found') {
        setError('No account found with this email. Try signing up or use Google sign-in.');
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError(err?.message || 'Failed to send reset email');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (isCompletingProfile) {
      if (!name || !phone) {
        setError('Please provide your name and phone number');
        return;
      }
      if (!validatePhone(phone)) {
        setError('Please provide a valid phone number');
        return;
      }
      setIsLoading(true);
      try {
        await updateDoc(doc(db, 'users', user!.uid), {
          name,
          phone,
          updatedAt: serverTimestamp()
        });
      } catch (err: any) {
        setError('Failed to update profile');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!email || !password) {
      setError('Please provide email and password');
      return;
    }

    if (isSignUp) {
      if (!name || !phone) {
        setError('Name and phone number are required for registration');
        return;
      }
      if (!validatePhone(phone)) {
        setError('Please provide a valid phone number');
        return;
      }
    }

    setIsLoading(true);

    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, name, phone);
        setMessage('Registration successful! Please login to complete your profile.');
        setIsSignUp(false);
        setPassword('');
        setName('');
        setPhone('');
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err: any) {
      setError(getAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    }
  };

  if (isForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center relative bg-transparent p-4">
        <WaveBackground level={waveLevel} state={floodState} />
        <div className="bg-white/85 backdrop-blur-md p-8 rounded-[1.5rem] shadow-xl border border-white/50 max-w-sm w-full">
          <div className="flex justify-center mb-6">
            <img 
              src="https://gjfwrphhhgodjhtgwmum.supabase.co/storage/v1/object/public/Logos/hydro_alert.png" 
              alt="HydroAlert Logo" 
              className="w-20 h-20 object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <h2 className="text-xl font-bold text-blue-900 mb-2 text-center">Reset Password</h2>
          <p className="text-slate-500 text-center mb-6 text-sm">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-600 p-3 rounded-lg text-sm text-center mb-4">
              {error}
            </div>
          )}

          {message && (
            <div className="bg-green-500/10 border border-green-500/20 text-green-700 p-3 rounded-lg text-sm text-center mb-4">
              {message}
            </div>
          )}

          <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-3 text-slate-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all font-medium text-sm"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white font-bold py-3 px-4 rounded-lg transition-colors mt-2"
            >
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <button 
              type="button"
              onClick={() => {
                setIsForgotPassword(false);
                setError('');
                setMessage('');
              }}
              className="w-full text-slate-400 hover:text-slate-600 font-semibold py-2 text-sm transition-colors"
            >
              Back to Log In
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (isCompletingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center relative bg-transparent p-4">
      <WaveBackground level={waveLevel} state={floodState} />
        <div className="bg-white/85 backdrop-blur-md p-8 rounded-[1.5rem] shadow-xl border border-white/50 max-w-sm w-full">
          <div className="flex justify-center mb-6">
            <img 
              src="https://gjfwrphhhgodjhtgwmum.supabase.co/storage/v1/object/public/Logos/hydro_alert.png" 
              alt="HydroAlert Logo" 
              className="w-20 h-20 object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <h2 className="text-xl font-bold text-blue-900 mb-2 text-center">Complete Your Profile</h2>
          <p className="text-slate-500 text-center mb-6 text-sm">We need a few more details to get you started.</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-600 p-3 rounded-lg text-sm text-center mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-3 text-slate-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all font-medium text-sm"
                  placeholder="Juan Dela Cruz"
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="tel" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-3 text-slate-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all font-medium text-sm"
                  placeholder="09123456789"
                  required
                />
              </div>
            </div>
            <button 
               type="submit" 
               disabled={isLoading}
               className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white font-bold py-3 px-4 rounded-lg transition-colors mt-2"
            >
               {isLoading ? 'Saving...' : 'Finish Setup'}
            </button>
            <button 
               type="button" 
               onClick={() => signOut()}
               className="w-full text-slate-400 hover:text-slate-600 font-semibold py-2 text-sm transition-colors mt-2"
            >
               Cancel & Log Out
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative bg-transparent p-4">
      <WaveBackground level={waveLevel} state={floodState} />
      
      <div className="bg-white/85 backdrop-blur-md p-8 rounded-[1.5rem] shadow-xl border border-white/50 max-w-sm w-full">
        <div className="flex justify-center mb-6">
          <img 
            src="https://gjfwrphhhgodjhtgwmum.supabase.co/storage/v1/object/public/Logos/hydro_alert.png" 
            alt="HydroAlert Logo" 
            className="w-24 h-24 object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        <h1 className="text-2xl font-bold text-center text-blue-900 mb-1 tracking-tight">HydroAlert</h1>
        <p className="text-blue-500 text-center mb-8 text-sm font-medium">Real-time Flood Monitoring & SOS</p>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-600 p-3 rounded-lg text-sm text-center mb-4">
            {error}
          </div>
        )}
        
        {message && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-700 p-3 rounded-lg text-sm text-center mb-4">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mb-6">
          {isSignUp && (
            <>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-3 text-slate-800 focus:outline-none focus:border-blue-400 transition-all font-medium text-sm"
                    placeholder="Enter your name"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="tel" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-3 text-slate-800 focus:outline-none focus:border-blue-400 transition-all font-medium text-sm"
                    placeholder="09123456789"
                    required
                  />
                </div>
              </div>
            </>
          )}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-3 text-slate-800 focus:outline-none focus:border-blue-400 transition-all font-medium text-sm"
                placeholder="Enter your email"
                required
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
              {!isSignUp && (
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(true);
                    setError('');
                    setMessage('');
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 focus:outline-none"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <input 
                 type={showPassword ? "text" : "password"} 
                 value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-800 focus:outline-none focus:border-blue-400 transition-all font-medium text-sm"
                 placeholder="Enter your password"
                 required
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button 
             type="submit" 
             disabled={isLoading}
             className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors mt-2 shadow-lg shadow-blue-200"
          >
             {isLoading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Log In')}
          </button>
        </form>

        <div className="flex items-center gap-4 mb-6">
           <div className="flex-1 h-px bg-slate-200"></div>
           <span className="text-xs font-semibold text-slate-400 uppercase">OR</span>
           <div className="flex-1 h-px bg-slate-200"></div>
        </div>

        <button
          onClick={handleGoogleLogin}
          type="button"
          className="w-full bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-3 transition-colors shadow-sm mb-6 text-sm"
        >
          <svg className="w-5 h-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>

        <p className="text-center text-sm font-medium text-slate-500">
           {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
           <button onClick={() => { setIsSignUp(!isSignUp); setIsForgotPassword(false); setError(''); setMessage(''); }} type="button" className="text-blue-600 hover:text-blue-700 font-bold focus:outline-none">
             {isSignUp ? 'Log in' : 'Sign up'}
           </button>
        </p>      
      </div>
    </div>
  );
};

