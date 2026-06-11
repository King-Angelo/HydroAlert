import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, signOut, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { formatMeters, meterValue } from '../lib/systemState';
import { doc, onSnapshot, collection, query, where, orderBy, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { updatePassword } from 'firebase/auth';
import { WaveBackground } from '../components/WaveBackground';
import { SosButton } from '../components/SosButton';
import { LogOut, Bell, Navigation, Home, Settings, User, Phone, Lock, Save, Eye, EyeOff, Map as MapIcon, Activity, ShieldAlert, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import { SafeMap } from '../components/SafeMap';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { motion, AnimatePresence } from 'motion/react';

export const UserDashboard: React.FC = () => {
  const { user, userData } = useAuth();
  const [systemState, setSystemState] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [sosStatus, setSosStatus] = useState<'idle' | 'sending' | 'active'>('idle');
  const [cooldown, setCooldown] = useState(0);
  const [safeZones, setSafeZones] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'home' | 'safety' | 'settings'>('home');
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    if (userData) {
      setName(userData.name || '');
      setPhone(userData.phone || '');
    }
  }, [userData]);

  useEffect(() => {
    const unsubState = onSnapshot(doc(db, 'systemState', 'current'), (snapshot) => {
      if (snapshot.exists()) {
        setSystemState(snapshot.data());
        setIsLoading(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'systemState/current');
      setIsLoading(false);
    });

    const qAlerts = query(collection(db, 'alerts'), orderBy('createdAt', 'desc'));
    const unsubAlerts = onSnapshot(qAlerts, (snapshot) => {
      const allAlerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAlerts(allAlerts.filter((a: any) => a.active === true));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'alerts'));

    if (user) {
      const qSos = query(
        collection(db, 'sosSignals'), 
        where('userId', '==', user.uid),
        where('active', '==', true)
      );
      const unsubSos = onSnapshot(qSos, (snapshot) => {
        if (!snapshot.empty) {
          setSosStatus('active');
          setCooldown(0); 
        } else {
          setSosStatus('idle');
        }
      }, (error) => handleFirestoreError(error, OperationType.GET, 'sosSignals'));
      
      const qZones = query(collection(db, 'safeZones'), orderBy('createdAt', 'desc'));
      const unsubZones = onSnapshot(qZones, (snapshot) => {
        setSafeZones(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isCustom: true })));
      }, (error) => handleFirestoreError(error, OperationType.GET, 'safeZones'));
      
      return () => {
        unsubState();
        unsubAlerts();
        unsubSos();
        unsubZones();
      };
    }
  }, [user]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSos = async (location: { latitude: number; longitude: number }) => {
    if (!user || cooldown > 0) return;
    setSosStatus('sending');
    try {
      await addDoc(collection(db, 'sosSignals'), {
        userId: user.uid,
        latitude: location.latitude,
        longitude: location.longitude,
        active: true,
        createdAt: serverTimestamp()
      });
      setCooldown(30);
    } catch (error) {
      console.error(error);
      handleFirestoreError(error, OperationType.CREATE, 'sosSignals');
      setSosStatus('idle');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsUpdating(true);
    setUpdateMsg({ type: '', text: '' });

    try {
      // Update Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        name,
        phone,
        updatedAt: serverTimestamp()
      });

      // Update Password if provided
      if (newPassword) {
        if (newPassword !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        if (newPassword.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
        await updatePassword(auth.currentUser!, newPassword);
        setNewPassword('');
        setConfirmPassword('');
      }

      setUpdateMsg({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err: any) {
      setUpdateMsg({ type: 'error', text: err.message || 'Failed to update profile' });
    } finally {
      setIsUpdating(false);
    }
  };

  let floodState: 'normal' | 'warning' | 'danger' = 'normal';
  let displayMessage = '';
  if (systemState) {
    if (Number(systemState.waterLevel) >= Number(systemState.dangerThreshold)) {
      floodState = 'danger';
      displayMessage = systemState.dangerMessage || 'EMERGENCY: Extreme flood risk. Evacuate immediately!';
    } else if (Number(systemState.waterLevel) >= Number(systemState.warningThreshold)) {
      floodState = 'warning';
      displayMessage = systemState.warningMessage || 'CAUTION: Water levels are rising. Prepare for potential evacuation.';
    } else {
      displayMessage = systemState.normalMessage || 'System Normal - No immediate flood risk.';
    }
  }

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="loader"
          initial={{ opacity: 1 }}
          exit={{ 
            opacity: 0,
            scale: 1.5,
            filter: 'blur(20px)',
            transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] }
          }}
          className="fixed inset-0 z-[9999]"
        >
          <LoadingSpinner fullScreen />
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="min-h-screen text-slate-800 flex flex-col pt-safe px-4 overflow-hidden relative pb-24 md:pb-8"
        >
          <WaveBackground level={systemState ? (meterValue(systemState.waterLevel) / meterValue(systemState.dangerThreshold)) * 80 : 10} state={floodState} />
          
          <header className="flex justify-between items-center py-6 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/30 shadow-lg p-1 overflow-hidden">
                <img 
                  src="https://gjfwrphhhgodjhtgwmum.supabase.co/storage/v1/object/public/Logos/hydro_alert.png" 
                  alt="HydroAlert Logo" 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h1 className="text-xl font-black text-white tracking-tight leading-none drop-shadow-md">HydroAlert</h1>
                <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mt-1">Hello, {userData?.fullName?.split(' ')[0] || user?.displayName?.split(' ')[0] || 'User'}</p>
              </div>
            </div>
            <button 
              onClick={() => auth.signOut()}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/20 group backdrop-blur-md"
            >
              <LogOut className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
            </button>
          </header>

          <main className="flex-1 flex flex-col z-10 w-full max-w-sm mx-auto overflow-y-auto no-scrollbar relative pb-24">
            {activeTab === 'home' ? (
              <div className="flex flex-col h-full justify-between pb-4 space-y-6">
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white/85 backdrop-blur-md border border-white/50 p-6 rounded-[2rem] shadow-xl flex flex-col items-center relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Activity className="w-24 h-24" />
                  </div>
                  <h2 className="text-[10px] uppercase tracking-[0.2em] text-blue-400 font-black mb-4 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    Current Water Level
                  </h2>
                  <div className="text-7xl font-black text-blue-900 flex items-baseline tracking-tighter drop-shadow-sm">
                    {systemState ? formatMeters(systemState.waterLevel, 2) : '--'}
                    <span className="text-2xl text-blue-400 font-bold ml-1 opacity-50">m</span>
                  </div>
                  {systemState && (
                    <div className="mt-4 flex gap-4 text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">
                      <span>Normal: {Number(systemState.normalThreshold).toFixed(1)}m</span>
                      <span className="text-orange-400">Warn: {Number(systemState.warningThreshold).toFixed(1)}m</span>
                    </div>
                  )}
                  <div className={clsx(
                    "mt-8 px-6 py-3 rounded-2xl font-black tracking-[0.15em] uppercase text-xs w-full text-center border shadow-sm transition-all duration-500",
                    floodState === 'danger' ? 'bg-red-500 text-white border-red-600 shadow-red-200' : 
                    floodState === 'warning' ? 'bg-orange-500 text-white border-orange-600 shadow-orange-200' : 
                    'bg-blue-600 text-white border-blue-700 shadow-blue-200'
                  )}>
                     STATUS: {floodState}
                  </div>
                  {displayMessage && (
                    <p className="mt-4 text-[10px] font-bold text-center text-slate-500 leading-relaxed max-w-[80%] uppercase tracking-wide opacity-80 italic">
                      "{displayMessage}"
                    </p>
                  )}
                </motion.div>

                {floodState !== 'normal' && (
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={clsx(
                      "p-6 rounded-[2rem] shadow-xl text-white relative overflow-hidden",
                      floodState === 'danger' ? "bg-red-600 shadow-red-200" : "bg-orange-500 shadow-orange-200"
                    )}
                  >
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-white opacity-10 rounded-full blur-2xl"></div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Automatic Broadcast</span>
                      </div>
                      <div className="flex items-center gap-1">
                         <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                         <span className="bg-white/20 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest">ACTIVE</span>
                      </div>
                    </div>
                    <p className="font-black text-xl leading-tight mb-2 tracking-tight">
                      {displayMessage}
                    </p>
                    <div className="flex items-center gap-2 mt-4 text-[9px] font-bold uppercase tracking-widest text-white/70">
                       <Activity className="w-3 h-3" /> System Level Checked: {format(new Date(), 'h:mm a')}
                    </div>
                  </motion.div>
                )}

                {alerts.some(a => a.level === 'announcement') && (
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-md text-slate-800 relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-blue-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Public Update</span>
                      </div>
                      <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-[8px] font-black tracking-widest">LATEST</span>
                    </div>
                    <div className="flex flex-col gap-4 max-h-48 overflow-y-auto pr-1 no-scrollbar relative z-10">
                      {alerts.filter(a => a.level === 'announcement').map(a => (
                        <div key={a.id} className="border-l-2 border-slate-100 pl-3 py-1">
                           <p className="font-bold text-sm text-slate-700 leading-tight mb-1">{a.message}</p>
                           {a.createdAt && (
                              <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">{format(a.createdAt.toDate(), 'h:mm a')}</p>
                           )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {alerts.some(a => a.level !== 'announcement') && (
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.35 }}
                    className="bg-slate-900 p-6 rounded-[2rem] shadow-xl text-white relative overflow-hidden"
                  >
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-white opacity-5 rounded-full blur-2xl"></div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Safety Logs</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-4 max-h-48 overflow-y-auto pr-1 no-scrollbar relative z-10">
                      {alerts.filter(a => a.level !== 'announcement').map(a => (
                        <div key={a.id} className="border-l-2 border-red-500 pl-3 py-1 bg-white/5 rounded-r-lg">
                           <p className="font-bold text-xs leading-tight mb-1">{a.message}</p>
                           {a.createdAt && (
                              <p className="text-[9px] text-white/50 font-bold uppercase tracking-widest">{format(a.createdAt.toDate(), 'h:mm a')}</p>
                           )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="flex flex-col items-center w-full"
                >
                  {sosStatus === 'active' ? (
                     <div className="flex flex-col items-center bg-red-600 border-4 border-red-500/50 p-8 rounded-[2.5rem] shadow-2xl relative w-full mb-4 group overflow-hidden">
                       <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-red-700"></div>
                       <motion.div 
                        animate={{ scale: [1, 1.2, 1] }} 
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="absolute inset-0 bg-white/5" 
                       />
                       <div className="bg-white p-5 rounded-full mb-6 shadow-xl relative z-10">
                        <Navigation className="w-10 h-10 text-red-600 fill-current" />
                       </div>
                       <h3 className="text-3xl font-black text-white mb-2 tracking-tighter relative z-10">SOS ACTIVE</h3>
                       <p className="text-center text-red-100 text-xs font-bold z-10 opacity-80 uppercase tracking-wide leading-relaxed">
                         PRECISE GPS LOCATION TRANSMITTED<br/>TO EMERGENCY RESPONSE UNITS.
                       </p>
                     </div>
                  ) : (
                    <div className="w-full flex flex-col items-center">
                      <SosButton onSosTrigger={handleSos} disabled={sosStatus === 'sending' || cooldown > 0} />
                      {cooldown > 0 && (
                        <p className="mt-4 text-[10px] font-black text-red-500 uppercase tracking-[0.2em] animate-pulse">
                          Cooldown: {cooldown}s
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              </div>
            ) : activeTab === 'safety' ? (
              <div className="flex flex-col gap-6 w-full">
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="bg-white/85 backdrop-blur-md border border-white/50 p-6 rounded-[2rem] shadow-xl flex flex-col"
                >
                  <h2 className="text-xl font-black text-blue-900 mb-2 flex items-center gap-2">
                    <MapIcon className="w-6 h-6 text-blue-600" /> Evacuation
                  </h2>
                  <p className="text-[10px] text-slate-400 mb-6 font-bold uppercase tracking-wider leading-relaxed">
                    Real-time safe zones and recommended routes.
                  </p>
                  
                  <div className="h-[380px] w-full rounded-2xl overflow-hidden border border-slate-200 mb-6 shadow-inner bg-slate-50">
                    <SafeMap height="100%" adminSafeZones={safeZones} />
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Priority Locations</h3>
                    {safeZones.length === 0 ? (
                      <div className="bg-slate-50 rounded-2xl p-6 border border-dashed border-slate-200 text-center">
                        <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest leading-loose">
                          No customized safe zones<br/>marked by dispatch.
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {safeZones.map(zone => (
                          <div key={zone.id} className="bg-white border border-slate-100 p-4 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-slate-800">{zone.name}</span>
                              <span className="text-[9px] text-blue-600 font-black uppercase tracking-[0.15em] mt-0.5">{zone.type}</span>
                            </div>
                            <a 
                              href={`https://www.google.com/maps/dir/?api=1&destination=${zone.lat},${zone.lng}`}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-blue-600 text-white text-[10px] font-black px-4 py-2 rounded-xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition"
                            >
                              START
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            ) : (
              <div className="flex flex-col gap-6 w-full">
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="bg-white/85 backdrop-blur-md border border-white/50 p-8 rounded-[2rem] shadow-xl"
                >
                  <div className="flex items-center gap-4 mb-10">
                    <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white text-3xl font-black shadow-2xl shadow-blue-200">
                      {userData?.fullName?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-800 tracking-tight">{userData?.fullName}</h2>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{user?.email}</p>
                    </div>
                  </div>

                  <div className="space-y-10">
                    <div>
                      <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mb-6">Vital Information</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Blood Group</span>
                          <span className="text-sm font-black text-blue-600">O Postive</span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Emergency ID</span>
                          <span className="text-sm font-black text-slate-800">{user?.uid.slice(0, 6).toUpperCase()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100/50">
                       <button 
                        onClick={() => auth.signOut()}
                        className="w-full py-5 bg-red-50 text-red-600 font-black text-[10px] uppercase tracking-[0.3em] rounded-3xl border border-red-100 hover:bg-red-100 transition-all shadow-sm"
                      >
                        Terminate Session
                      </button>
                    </div>
                  </div>
                </motion.div>
                
                <div className="bg-blue-600 p-8 rounded-[2rem] shadow-xl text-white relative overflow-hidden group">
                  <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
                  <h4 className="text-base font-black mb-3 relative z-10 tracking-tight">System Security</h4>
                  <p className="text-[10px] font-bold text-blue-100 leading-relaxed mb-6 relative z-10 opacity-80 uppercase tracking-wider">
                    Your data is securely encrypted. We prioritize your privacy and safety during all emergency monitoring activities.
                  </p>
                  <div className="flex items-center gap-3 relative z-10 px-4 py-2 bg-white/10 rounded-xl w-fit">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-[8px] font-black uppercase tracking-[0.2em]">SECURE CONNECTION</span>
                  </div>
                </div>
              </div>
            )}
          </main>

          <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-white/90 backdrop-blur-2xl border border-white/50 rounded-[2.5rem] p-2 shadow-2xl z-50 flex items-center justify-around overflow-hidden border-t-2">
            <button 
              onClick={() => setActiveTab('home')}
              className={clsx(
                "flex flex-col items-center gap-1 py-3 px-6 rounded-3xl transition-all duration-500",
                activeTab === 'home' ? "bg-blue-600 text-white shadow-xl shadow-blue-200 scale-105" : "text-slate-300 hover:text-slate-500"
              )}
            >
              <Home className={clsx("w-6 h-6", activeTab === 'home' ? "fill-current" : "stroke-[2.5]")} />
              <span className="text-[8px] font-black uppercase tracking-widest">Dash</span>
            </button>

            <button 
              onClick={() => setActiveTab('safety')}
              className={clsx(
                "flex flex-col items-center gap-1 py-3 px-6 rounded-3xl transition-all duration-500",
                activeTab === 'safety' ? "bg-blue-600 text-white shadow-xl shadow-blue-200 scale-105" : "text-slate-300 hover:text-slate-500"
              )}
            >
              <MapIcon className={clsx("w-6 h-6", activeTab === 'safety' ? "fill-current" : "stroke-[2.5]")} />
              <span className="text-[8px] font-black uppercase tracking-widest">Maps</span>
            </button>

            <button 
              onClick={() => setActiveTab('settings')}
              className={clsx(
                "flex flex-col items-center gap-1 py-3 px-6 rounded-3xl transition-all duration-500",
                activeTab === 'settings' ? "bg-blue-600 text-white shadow-xl shadow-blue-200 scale-105" : "text-slate-300 hover:text-slate-500"
              )}
            >
              <User className={clsx("w-6 h-6", activeTab === 'settings' ? "fill-current" : "stroke-[2.5]")} />
              <span className="text-[8px] font-black uppercase tracking-widest">Self</span>
            </button>
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
