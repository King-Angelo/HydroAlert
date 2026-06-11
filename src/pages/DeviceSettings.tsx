import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, signOut, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { WaveBackground } from '../components/WaveBackground';
import { LogOut, Activity, Settings2, AlertCircle, ShieldAlert, Home, Save, Lock, Eye, EyeOff, ChevronLeft, Bell } from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';

export const DeviceSettings: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [systemState, setSystemState] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  
  const [formData, setFormData] = useState({
    normalThreshold: 0,
    warningThreshold: 0,
    dangerThreshold: 0,
    maxHeight: 4,
    normalMessage: '',
    warningMessage: '',
    dangerMessage: ''
  });

  const [pwData, setPwData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPw, setShowPw] = useState(false);
  const [pwStatus, setPwStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'systemState', 'current'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setSystemState(data);
        setFormData({
          normalThreshold: Number(data.normalThreshold),
          warningThreshold: Number(data.warningThreshold),
          dangerThreshold: Number(data.dangerThreshold),
          maxHeight: Math.min(4, Math.max(0.01, Math.round((Number(data.maxHeight) || 4) * 100) / 100)),
          normalMessage: data.normalMessage || 'System Normal',
          warningMessage: data.warningMessage || 'Warning: Rising Water',
          dangerMessage: data.dangerMessage || 'Danger: Evacuate Now'
        });
        setIsLoading(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'systemState/current');
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  const handleUpdateConfig = async () => {
    if (formData.warningThreshold >= formData.dangerThreshold) {
      alert("Warning threshold must be lower than Danger threshold!");
      return;
    }
    setSaveStatus('saving');
    try {
      await updateDoc(doc(db, 'systemState', 'current'), {
        normalThreshold: Number(formData.normalThreshold).toFixed(1),
        warningThreshold: Number(formData.warningThreshold).toFixed(1),
        dangerThreshold: Number(formData.dangerThreshold).toFixed(1),
        maxHeight: Number(formData.maxHeight).toFixed(2),
        normalMessage: formData.normalMessage,
        warningMessage: formData.warningMessage,
        dangerMessage: formData.dangerMessage,
        updatedAt: serverTimestamp()
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'systemState/current');
      setSaveStatus('error');
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    if (pwData.newPassword !== pwData.confirmPassword) {
      setPwError("Passwords don't match");
      return;
    }
    if (pwData.newPassword.length < 6) {
      setPwError("Password must be at least 6 characters");
      return;
    }

    setPwStatus('loading');
    setPwError('');

    try {
      const credential = EmailAuthProvider.credential(user.email, pwData.currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, pwData.newPassword);
      setPwStatus('success');
      setPwData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPwStatus('idle'), 3000);
    } catch (error: any) {
      setPwStatus('error');
      setPwError(error.message || "Failed to update password");
    }
  };

  let floodState: 'normal' | 'warning' | 'danger' = 'normal';
  if (systemState) {
    if (Number(systemState.waterLevel) >= Number(systemState.dangerThreshold)) {
      floodState = 'danger';
    } else if (Number(systemState.waterLevel) >= Number(systemState.warningThreshold)) {
      floodState = 'warning';
    }
  }

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <LoadingSpinner fullScreen key="loader" />
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="min-h-screen bg-slate-50 relative pb-20"
        >
          <WaveBackground level={systemState ? (systemState.waterLevel / systemState.dangerThreshold) * 80 : 10} state={floodState} />
          
          <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
            <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link to="/admin" className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Settings2 className="w-5 h-5 text-blue-600" /> Device Configuration
                  </h1>
                  <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">System Settings & Security</p>
                </div>
              </div>
              <button 
                onClick={handleUpdateConfig}
                disabled={saveStatus === 'saving'}
                className={clsx(
                  "flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg",
                  saveStatus === 'success' ? "bg-green-500 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
                )}
              >
                {saveStatus === 'saving' ? 'Saving...' : (
                  <>
                    <Save className="w-4 h-4" /> 
                    {saveStatus === 'success' ? 'Saved' : 'Save Changes'}
                  </>
                )}
              </button>
            </div>
          </header>

          <main className="max-w-4xl mx-auto px-6 py-10 relative z-10 grid gap-8">
            
            <section className="bg-white rounded-[2rem] p-8 shadow-xl border border-white">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-8 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-slate-400" /> Hardware Configuration
              </h2>
              <div className="grid gap-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <label className="text-slate-500 font-black uppercase text-[10px] tracking-widest">Maximum Sensor Height</label>
                    <span className="text-slate-900 font-mono font-bold text-lg">{formData.maxHeight.toFixed(2)}m</span>
                  </div>
                  <input 
                    type="range" min="0.01" max="4" step="0.01" 
                    value={formData.maxHeight} 
                    onChange={e => {
                      const val = Math.round(parseFloat(e.target.value) * 100) / 100;
                      setFormData(prev => ({
                        ...prev,
                        maxHeight: val,
                        dangerThreshold: Math.min(prev.dangerThreshold, val),
                        warningThreshold: Math.min(prev.warningThreshold, val - 0.1),
                        normalThreshold: Math.min(prev.normalThreshold, val - 0.2)
                      }));
                    }} 
                    className="w-full h-3 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-slate-900" 
                  />
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Adjust this according to your actual sensor's vertical range.</p>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-[2rem] p-8 shadow-xl border border-white">
              <h2 className="text-sm font-black uppercase tracking-widest text-blue-900 mb-8 flex items-center gap-2">
                <Activity className="w-4 h-4" /> Water Level Thresholds (m)
              </h2>
              
              <div className="grid gap-10">
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <label className="text-green-600 font-black uppercase text-[10px] tracking-widest">Normal Range</label>
                    <span className="text-green-600 font-mono font-bold text-lg">{formData.normalThreshold.toFixed(1)}m</span>
                  </div>
                  <input 
                    type="range" min="0" max={formData.maxHeight} step="0.1" 
                    value={formData.normalThreshold} 
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      setFormData(prev => ({
                        ...prev,
                        normalThreshold: val,
                        warningThreshold: Math.max(prev.warningThreshold, Math.min(val + 0.1, prev.maxHeight)),
                        dangerThreshold: Math.max(prev.dangerThreshold, Math.min(val + 0.2, prev.maxHeight))
                      }));
                    }} 
                    className="w-full h-3 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-green-600" 
                  />
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Sets the upper limit for 'Safe' status.</p>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <label className="text-orange-500 font-black uppercase text-[10px] tracking-widest">Warning Point</label>
                    <span className="text-orange-500 font-mono font-bold text-lg">{formData.warningThreshold.toFixed(1)}m</span>
                  </div>
                  <input 
                    type="range" min={Math.min(formData.normalThreshold + 0.1, formData.maxHeight - 0.1).toFixed(1)} max={formData.maxHeight} step="0.1" 
                    value={formData.warningThreshold} 
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      setFormData(prev => ({
                        ...prev,
                        warningThreshold: val,
                        dangerThreshold: Math.max(prev.dangerThreshold, Math.min(val + 0.1, prev.maxHeight))
                      }));
                    }} 
                    className="w-full h-3 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-orange-500" 
                  />
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Triggers the 'Warning' automatic broadcast.</p>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <label className="text-red-600 font-black uppercase text-[10px] tracking-widest">Danger Point</label>
                    <span className="text-red-600 font-mono font-bold text-lg">{formData.dangerThreshold.toFixed(1)}m</span>
                  </div>
                  <input 
                    type="range" min={Math.min(formData.warningThreshold + 0.1, formData.maxHeight).toFixed(1)} max={formData.maxHeight} step="0.1" 
                    value={formData.dangerThreshold} 
                    onChange={e => setFormData(prev => ({ ...prev, dangerThreshold: parseFloat(e.target.value) }))} 
                    className="w-full h-3 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-red-600" 
                  />
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Triggers the 'Emergency' evacuation broadcast.</p>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-[2rem] p-8 shadow-xl border border-white">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-8 flex items-center gap-2">
                <Bell className="w-4 h-4 text-slate-400" /> Automatic Broadcast Messages
              </h2>

              <div className="grid gap-6">
                <div className="space-y-2">
                  <label className="text-green-600 font-black uppercase text-[10px] tracking-widest">Normal Level Message</label>
                  <textarea 
                     value={formData.normalMessage}
                     onChange={e => setFormData({...formData, normalMessage: e.target.value})}
                     className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:border-green-400 min-h-[80px] transition-all"
                     placeholder="Message for normal levels..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-orange-500 font-black uppercase text-[10px] tracking-widest">Warning Level Message</label>
                  <textarea 
                     value={formData.warningMessage}
                     onChange={e => setFormData({...formData, warningMessage: e.target.value})}
                     className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:border-orange-400 min-h-[80px] transition-all"
                     placeholder="Message for warning levels..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-red-600 font-black uppercase text-[10px] tracking-widest">Danger Level Message</label>
                  <textarea 
                     value={formData.dangerMessage}
                     onChange={e => setFormData({...formData, dangerMessage: e.target.value})}
                     className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:border-red-400 min-h-[80px] transition-all"
                     placeholder="Message for danger levels..."
                  />
                </div>
              </div>
            </section>

            <section className="bg-white rounded-[2rem] p-8 shadow-xl border border-white">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-8 flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-400" /> Admin Security Settings
              </h2>

              <form onSubmit={handleUpdatePassword} className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2 col-span-full">
                  <label className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Current Password</label>
                  <div className="relative">
                    <input 
                       type={showPw ? 'text' : 'password'}
                       value={pwData.currentPassword}
                       required
                       onChange={e => setPwData({...pwData, currentPassword: e.target.value})}
                       className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 pr-12"
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-slate-400 font-black uppercase text-[10px] tracking-widest">New Password</label>
                  <input 
                     type="password"
                     value={pwData.newPassword}
                     required
                     onChange={e => setPwData({...pwData, newPassword: e.target.value})}
                     className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Confirm New Password</label>
                  <input 
                     type="password"
                     value={pwData.confirmPassword}
                     required
                     onChange={e => setPwData({...pwData, confirmPassword: e.target.value})}
                     className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>

                {pwError && <p className="text-red-500 text-[10px] font-bold uppercase tracking-wider col-span-full">{pwError}</p>}
                
                <div className="col-span-full pt-4">
                  <button 
                    type="submit"
                    disabled={pwStatus === 'loading'}
                    className={clsx(
                      "w-full md:w-auto px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all",
                      pwStatus === 'success' ? "bg-green-500 text-white" : "bg-slate-900 text-white hover:bg-black"
                    )}
                  >
                    {pwStatus === 'loading' ? 'Updating...' : pwStatus === 'success' ? 'Password Updated' : 'Update Password'}
                  </button>
                </div>
              </form>
            </section>

          </main>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
