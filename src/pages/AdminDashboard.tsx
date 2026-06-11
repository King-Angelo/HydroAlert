import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, signOut, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot, collection, query, where, orderBy, setDoc, updateDoc, serverTimestamp, getDocs, addDoc } from 'firebase/firestore';
import { WaveBackground } from '../components/WaveBackground';
import { LogOut, Activity, Settings2, AlertCircle, Navigation, CheckCircle, ShieldAlert, MapPin, Users, UserCog, Map as MapIcon, Home, Bell, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { SafeMap } from '../components/SafeMap';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [systemState, setSystemState] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [sosSignals, setSosSignals] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [safeZones, setSafeZones] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'map'>('overview');
  
  const [isAddingZone, setIsAddingZone] = useState<[number, number] | null>(null);
  const [zoneName, setZoneName] = useState('');

  const [newAlert, setNewAlert] = useState({ message: '', level: 'warning' });
  const [newAnnouncement, setNewAnnouncement] = useState('');

  useEffect(() => {
    const initSystem = async () => {
       try {
         const snap = await getDocs(query(collection(db, 'systemState')));
         if (snap.empty) {
            await setDoc(doc(db, 'systemState', 'current'), {
              waterLevel: 1.0,
              normalThreshold: 0.5,
              warningThreshold: 1.5,
              dangerThreshold: 3.0,
              updatedAt: serverTimestamp()
            });
         }
       } catch (error) {
         console.error(error);
       }
    };
    initSystem();

    const unsubState = onSnapshot(doc(db, 'systemState', 'current'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setSystemState(data);
        setIsLoading(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'systemState/current');
      setIsLoading(false);
    });

    const qAlerts = query(collection(db, 'alerts'), orderBy('createdAt', 'desc'));
    const unsubAlerts = onSnapshot(qAlerts, (snapshot) => {
      setAlerts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'alerts'));

    const qSos = query(collection(db, 'sosSignals'), orderBy('createdAt', 'desc'));
    const unsubSos = onSnapshot(qSos, (snapshot) => {
      setSosSignals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'sosSignals'));

    const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));

    const qZones = query(collection(db, 'safeZones'), orderBy('createdAt', 'desc'));
    const unsubZones = onSnapshot(qZones, (snapshot) => {
      setSafeZones(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isCustom: true })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'safeZones'));

    return () => {
      unsubState();
      unsubAlerts();
      unsubSos();
      unsubUsers();
      unsubZones();
    };
  }, []);


  const handleToggleUserRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!newAnnouncement) return;
    try {
      await addDoc(collection(db, 'alerts'), {
        level: 'announcement',
        message: newAnnouncement,
        active: true,
        createdAt: serverTimestamp()
      });
      setNewAnnouncement('');
    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, 'alerts');
    }
  };

  const handleCreateAlert = async () => {
    if (!newAlert.message) return;
    try {
      await addDoc(collection(db, 'alerts'), {
        level: newAlert.level,
        message: newAlert.message,
        active: true,
        createdAt: serverTimestamp()
      });
      setNewAlert({ message: '', level: 'warning' });
    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, 'alerts');
    }
  };

  const handleResolveAlert = async (id: string) => {
    try {
      await updateDoc(doc(db, 'alerts', id), {
        active: false,
        resolvedAt: serverTimestamp()
      });
    } catch (error) {
       handleFirestoreError(error, OperationType.UPDATE, `alerts/${id}`);
    }
  };

  const handleResolveSos = async (id: string) => {
     try {
       await updateDoc(doc(db, 'sosSignals', id), {
         active: false,
         resolvedAt: serverTimestamp()
       });
     } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `sosSignals/${id}`);
     }
  };

  const handleAddSafeZone = async () => {
    if (!isAddingZone || !zoneName.trim()) return;
    try {
      await addDoc(collection(db, 'safeZones'), {
        name: zoneName.trim(),
        lat: isAddingZone[0],
        lng: isAddingZone[1],
        type: 'Evacuation Center',
        createdAt: serverTimestamp()
      });
      setIsAddingZone(null);
      setZoneName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'safeZones');
    }
  };

  const handleDeleteSafeZone = async (id: string) => {
    if (!confirm("Remove this evacuation location?")) return;
    try {
      const { deleteDoc: firestoreDeleteDoc } = await import('firebase/firestore');
      await firestoreDeleteDoc(doc(db, 'safeZones', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `safeZones/${id}`);
    }
  };


  let floodState: 'normal' | 'warning' | 'danger' = 'normal';
  if (systemState) {
    if (systemState.waterLevel >= systemState.dangerThreshold) {
      floodState = 'danger';
    } else if (systemState.waterLevel >= systemState.warningThreshold) {
      floodState = 'warning';
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
          className="min-h-screen bg-transparent text-slate-800 pb-24 md:pb-12 relative"
        >
           <WaveBackground level={systemState ? (systemState.waterLevel / systemState.dangerThreshold) * 80 : 10} state={floodState} />
       
       <header className="bg-white/85 backdrop-blur-md border border-white/50 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
             <div className="flex items-center gap-3">
                <div className="bg-white/50 p-1 rounded-lg shadow-sm border border-white/20">
                  <img 
                    src="https://gjfwrphhhgodjhtgwmum.supabase.co/storage/v1/object/public/Logos/hydro_alert.png" 
                    alt="HydroAlert Logo" 
                    className="w-10 h-10 object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-blue-900 tracking-tight leading-tight">Admin Console</h1>
                  <p className="text-[10px] uppercase font-bold text-blue-500 tracking-wider">HydroAlert System</p>
                </div>
             </div>
              <div className="flex items-center gap-6">
                 <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                   <button 
                     onClick={() => setActiveTab('overview')}
                     className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                   >
                     Overview
                   </button>
                   <button 
                     onClick={() => setActiveTab('users')}
                     className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                   >
                     Users
                   </button>
                   <button 
                     onClick={() => setActiveTab('map')}
                     className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'map' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                   >
                     Map
                   </button>
                 </nav>
                 <Link 
                   to="/admin/settings" 
                   className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold transition-all shadow-sm"
                   title="Device Configuration"
                 >
                   <Settings className="w-4 h-4" />
                 </Link>
                 <button onClick={signOut} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-blue-800 text-sm font-semibold shadow-sm transition-colors">
                   <LogOut className="w-4 h-4" /> Sign out
                 </button>
              </div>
           </div>
       </header>

       <main className="max-w-7xl mx-auto px-6 mt-8 flex flex-col md:flex-row gap-8 relative z-10">
         {activeTab === 'overview' ? (
           <>
          <div className="w-full md:w-1/3 flex flex-col gap-6">
             <div className="bg-white/90 backdrop-blur-md border border-white/50 rounded-[1.5rem] p-6 shadow-xl space-y-6">
              <div className="flex items-center justify-between">
                 <h2 className="text-xs uppercase tracking-widest text-blue-400 font-bold flex items-center gap-2">
                   <Activity className="w-4 h-4" /> Live Simulator
                 </h2>
                 <Link 
                   to="/admin/settings" 
                   className="p-2 rounded-lg bg-slate-50 text-slate-400 hover:text-blue-600 border border-slate-100 hover:border-blue-100 transition-all shadow-sm"
                   title="Adjust Thresholds & Messages"
                 >
                   <Settings2 className="w-4 h-4" />
                 </Link>
              </div>

               <div className="flex flex-col items-center py-6">
                 <div className="text-7xl font-black text-blue-900 mb-6 tracking-tighter drop-shadow-sm">
                    {systemState?.waterLevel.toFixed(1)}<span className="text-2xl text-slate-300 font-bold ml-1">m</span>
                 </div>
                 
                 <div className={clsx(
                    "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border w-full text-center shadow-sm",
                    floodState === 'danger' ? 'bg-red-500 text-white border-red-600' : 
                    floodState === 'warning' ? 'bg-orange-500 text-white border-orange-600' : 
                    'bg-blue-600 text-white border-blue-700'
                 )}>
                   Current Status: {floodState}
                 </div>

                 <div className="mt-6 w-full text-center px-4">
                    <p className="text-[10px] font-bold text-slate-400 italic leading-relaxed">
                      "{floodState === 'danger' ? systemState?.dangerMessage : floodState === 'warning' ? systemState?.warningMessage : systemState?.normalMessage}"
                    </p>
                 </div>
               </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="bg-white/90 backdrop-blur-md border border-white/50 rounded-[1.5rem] p-6 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                  <Bell className="w-16 h-16" />
                </div>
                <h2 className="text-xs uppercase tracking-widest text-blue-600 font-bold mb-4 flex items-center gap-2">
                  <Bell className="w-4 h-4" /> Public Announcement
                </h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-4 tracking-wider leading-relaxed">
                  Post a manual announcement to all users (General updates, non-emergency events).
                </p>
                <div className="flex flex-col gap-3">
                  <textarea 
                    placeholder="Type general announcement here..." 
                    rows={4}
                    value={newAnnouncement}
                    onChange={e => setNewAnnouncement(e.target.value)}
                    className="bg-slate-50/50 border border-slate-100 text-sm font-medium rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:border-blue-400 shadow-inner resize-none"
                  />
                  <button 
                    onClick={handleCreateAnnouncement} 
                    disabled={!newAnnouncement} 
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black tracking-[0.1em] uppercase text-[10px] py-4 rounded-xl shadow-lg shadow-blue-100 transition-all flex items-center justify-center gap-2"
                  >
                     <Bell className="w-4 h-4" /> Post Public Update
                  </button>
                </div>
              </div>
            </div>

          </div>

          <div className="w-full md:w-2/3 flex flex-col gap-6">
             <div className="bg-white/90 backdrop-blur-md border border-white/50 rounded-[1.5rem] p-6 shadow-xl min-h-[300px]">
               <h2 className="text-xs uppercase tracking-widest text-red-500 font-bold mb-4 flex items-center gap-2">
                <Navigation className="w-4 h-4" /> Active Emergency SOS
               </h2>

               <div className="grid gap-3">
                 {sosSignals.filter(s => s.active).length === 0 && (
                    <div className="text-center py-10 px-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl">
                       <p className="text-slate-400 font-semibold text-sm">No active SOS signals.</p>
                    </div>
                 )}
                 {sosSignals.filter(s => s.active).map(sos => (
                    <div key={sos.id} className="flex flex-col md:flex-row justify-between items-start md:items-center bg-red-50 border border-red-100 p-4 rounded-xl gap-4 shadow-sm">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                           <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Active</span>
                           <span className="text-red-400 text-[10px] font-bold uppercase tracking-wider">{sos.createdAt ? format(sos.createdAt.toDate(), 'MMM d, h:mm:ss a') : ''}</span>
                        </div>
                        <p className="text-xs font-bold text-slate-800 mt-2">User UID: {sos.userId.substring(0,8)}...</p>
                        <p className="text-sm text-slate-600 mt-1 flex items-center gap-1 font-medium">
                           <MapPin className="w-4 h-4 text-blue-500" /> {sos.latitude.toFixed(6)}, {sos.longitude.toFixed(6)}
                            <a href={`https://www.google.com/maps/search/?api=1&query=${sos.latitude},${sos.longitude}`} target="_blank" rel="noreferrer" className="text-blue-600 ml-2 hover:underline text-xs bg-blue-100 px-2 py-1 rounded">View Map</a>
                        </p>
                      </div>
                      <button onClick={() => handleResolveSos(sos.id)} className="shrink-0 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm">
                        <CheckCircle className="w-4 h-4 text-green-500" /> Mark Resolved
                      </button>
                    </div>
                 ))}
               </div>
             </div>

             <div className="bg-white/90 backdrop-blur-md border border-white/50 rounded-[1.5rem] p-6 shadow-xl">
               <h2 className="text-xs uppercase tracking-widest text-slate-500 font-bold flex items-center gap-2 mb-4">
                <AlertCircle className="w-4 h-4" /> Manage Active Alerts
               </h2>
               <div className="grid gap-3">
                 {alerts.filter(a => a.active).length === 0 && (
                    <div className="text-center py-6 px-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl">
                       <p className="text-slate-400 font-semibold text-sm">No active alerts broadcasted.</p>
                    </div>
                 )}
                 {alerts.filter(a => a.active).map(alert => (
                    <div key={alert.id} className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border border-slate-100 p-4 rounded-xl gap-4 shadow-sm">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                           <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${alert.level === 'danger' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'}`}>{alert.level}</span>
                           <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">{alert.createdAt ? format(alert.createdAt.toDate(), 'MMM d, h:mm a') : ''}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-800 mt-2 leading-snug">{alert.message}</p>
                      </div>
                      <button onClick={() => handleResolveAlert(alert.id)} className="shrink-0 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-lg transition-colors">
                         Resolve
                      </button>
                    </div>
                 ))}
                </div>
             </div>
          </div>
          </>
          ) : activeTab === 'users' ? (
            <div className="w-full">
               <div className="bg-white/90 backdrop-blur-md border border-white/50 rounded-[1.5rem] p-8 shadow-xl">
                  <h2 className="text-xl font-bold text-blue-900 mb-6 flex items-center gap-2">
                    <Users className="w-6 h-6 text-blue-500" /> Registered Users Management
                  </h2>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="py-4 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">User</th>
                          <th className="py-4 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Email</th>
                          <th className="py-4 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Join Date</th>
                          <th className="py-4 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Role</th>
                          <th className="py-4 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-2">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                                  {u.email?.[0].toUpperCase()}
                                </div>
                                <span className="text-sm font-bold text-slate-700 truncate max-w-[120px]">
                                  {u.id.substring(0, 8)}...
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-2 text-sm text-slate-500 font-medium">{u.email}</td>
                            <td className="py-4 px-2 text-sm text-slate-400 font-mono">
                              {u.createdAt ? format(u.createdAt.toDate(), 'MMM d, yyyy') : '--'}
                            </td>
                            <td className="py-4 px-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${u.role === 'admin' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="py-4 px-2 text-right">
                              <button 
                                onClick={() => handleToggleUserRole(u.id, u.role)}
                                disabled={u.id === user?.uid}
                                className="p-2 text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Change Role"
                              >
                                <UserCog className="w-5 h-5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               </div>
            </div>
          ) : (
          <div className="w-full flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-white/90 backdrop-blur-md border border-white/50 rounded-[1.5rem] p-6 shadow-xl flex flex-col">
                 <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-blue-900 flex items-center gap-2">
                        <MapIcon className="w-6 h-6 text-green-500" /> System Map & Safe Zones
                      </h2>
                      <p className="text-xs text-slate-500 font-medium mt-1">Click the map to pin evacuation centers.</p>
                    </div>
                    
                    <button 
                      onClick={() => {
                        if (isAddingZone) {
                          setIsAddingZone(null);
                        } else {
                          alert("Click anywhere on the map to drop a pin.");
                        }
                      }}
                      className={clsx(
                        "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-sm border",
                        isAddingZone ? "bg-red-50 text-red-600 border-red-200" : "bg-blue-600 text-white border-blue-700 hover:bg-blue-700 hover:shadow-md"
                      )}
                    >
                      {isAddingZone ? "Cancel Pinning" : "Add New Safe Zone"}
                    </button>
                 </div>
                 
                 <div className="h-[450px] min-h-[400px] rounded-xl overflow-hidden shadow-inner border border-slate-100 mb-6 relative">
                   <SafeMap 
                     height="100%" 
                     adminSafeZones={safeZones} 
                     onMapClick={(lat, lng) => setIsAddingZone([lat, lng])} 
                     onDeleteSafeZone={handleDeleteSafeZone} 
                   />
                   
                   {isAddingZone && (
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md p-4 rounded-2xl border-2 border-blue-400 shadow-2xl z-[2000] flex flex-col gap-3 min-w-[250px] animate-in zoom-in-95 duration-200">
                         <div className="flex items-center gap-2 text-blue-600 mb-1">
                            <MapPin className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Pinning New Location</span>
                         </div>
                         <input 
                           type="text" 
                           placeholder="Center Name (e.g. City Hall)" 
                           value={zoneName} 
                           autoFocus
                           onChange={e => setZoneName(e.target.value)} 
                           className="text-sm bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 shadow-inner"
                         />
                         <div className="flex gap-2">
                           <button onClick={handleAddSafeZone} disabled={!zoneName.trim()} className="flex-1 bg-blue-600 disabled:opacity-50 text-white text-[10px] font-bold py-2 rounded-lg uppercase tracking-wider">Save Zone</button>
                           <button onClick={() => setIsAddingZone(null)} className="bg-slate-100 text-slate-500 text-[10px] font-bold py-2 px-4 rounded-lg uppercase tracking-wider">Cancel</button>
                         </div>
                      </div>
                    )}
                 </div>

                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-dashed border-slate-200 pb-2">Active Evacuation Centers</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                   {safeZones.length === 0 && (
                      <div className="col-span-full py-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                         <p className="text-slate-400 text-xs font-medium italic">No custom zones added yet. Click the map to add one.</p>
                      </div>
                   )}
                   {safeZones.map(zone => (
                     <div key={zone.id} className="bg-white border border-slate-100 p-3 rounded-xl flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                       <div>
                         <p className="text-sm font-bold text-slate-800">{zone.name}</p>
                         <p className="text-[10px] text-slate-400 font-medium">{zone.lat.toFixed(4)}, {zone.lng.toFixed(4)}</p>
                       </div>
                       <button onClick={() => handleDeleteSafeZone(zone.id)} className="text-red-400 hover:text-red-600 p-2 transition-colors">
                          <ShieldAlert className="w-4 h-4" />
                       </button>
                     </div>
                   ))}
                 </div>
              </div>
           </div>
          )}
       </main>

       {/* Bottom Navigation for Mobile */}
       <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-white/90 backdrop-blur-xl border border-white/50 rounded-[2rem] p-2 shadow-2xl z-50 flex md:hidden items-center justify-around overflow-hidden">
        <button 
          onClick={() => setActiveTab('overview')}
          className={clsx(
            "flex flex-col items-center gap-1 py-3 px-6 rounded-2xl transition-all duration-300",
            activeTab === 'overview' ? "bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <Home className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
        </button>

        <button 
          onClick={() => setActiveTab('users')}
          className={clsx(
            "flex flex-col items-center gap-1 py-3 px-6 rounded-2xl transition-all duration-300",
            activeTab === 'users' ? "bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <Users className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Users</span>
        </button>

        <button 
          onClick={() => setActiveTab('map')}
          className={clsx(
            "flex flex-col items-center gap-1 py-3 px-6 rounded-2xl transition-all duration-300",
            activeTab === 'map' ? "bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <MapIcon className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Map</span>
        </button>
      </nav>
    </motion.div>
      )}
    </AnimatePresence>
  );
};
