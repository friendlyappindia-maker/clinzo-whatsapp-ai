/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Hospital as HospitalIcon, 
  Stethoscope, 
  LayoutDashboard, 
  PlusCircle, 
  ClipboardList, 
  LogOut, 
  ChevronRight, 
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Building2,
  HeartHandshake,
  MapPin,
  Trash2,
  Edit,
  UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Hospital, Referral, ReferralStatus, NGO, HospitalSpecialization } from './types';

// --- Components ---

const StatusBadge = ({ status }: { status: ReferralStatus }) => {
  const colors: Record<ReferralStatus, string> = {
    CREATED: 'bg-blue-100 text-blue-700 border-blue-200',
    ARRIVED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    MEDICATION_DONE: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    PACKAGE_PROPOSAL: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    SURGERY_RECOMMENDED: 'bg-orange-100 text-orange-700 border-orange-200',
    SURGERY_SCHEDULED: 'bg-amber-100 text-amber-700 border-amber-200',
    FOLLOW_UP_SURGERY: 'bg-violet-100 text-violet-700 border-violet-200',
    SURGERY_LOST: 'bg-red-100 text-red-700 border-red-200',
    SURGERY_COMPLETED: 'bg-brand-100 text-brand-700 border-brand-200',
    SCHEDULED: 'bg-sky-100 text-sky-700 border-sky-200',
    FOLLOW_UP: 'bg-purple-100 text-purple-700 border-purple-200',
    REVISIT: 'bg-pink-100 text-pink-700 border-pink-200',
    CASE_CLOSED: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[status]}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'dashboard' | 'referrals' | 'hospitals' | 'new-referral' | 'users' | 'hospital-profile' | 'doctors'>('dashboard');
  const [selectedHospitalId, setSelectedHospitalId] = useState<number | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [selectedHospitalData, setSelectedHospitalData] = useState<Hospital | null>(null);
  const [selectedDoctorData, setSelectedDoctorData] = useState<User | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [ngos, setNgos] = useState<NGO[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [hospitalSpecializations, setHospitalSpecializations] = useState<HospitalSpecialization[]>([]);
  const [hospitalDoctors, setHospitalDoctors] = useState<User[]>([]);
  const [allDoctors, setAllDoctors] = useState<User[]>([]);
  const [referralFormHospitalId, setReferralFormHospitalId] = useState<string>('');
  const [referralFormSpecialty, setReferralFormSpecialty] = useState<string>('');
  const [referralFormDoctorId, setReferralFormDoctorId] = useState<string>('');
  const [referralFormSpecialties, setReferralFormSpecialties] = useState<HospitalSpecialization[]>([]);
  const [referralFormPatientName, setReferralFormPatientName] = useState<string>('');
  const [referralFormPatientMobile, setReferralFormPatientMobile] = useState<string>('');
  const [hospitalActiveTab, setHospitalActiveTab] = useState<'general' | 'specializations' | 'doctors'>('general');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [error, setError] = useState('');
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    checkDbStatus();
  }, []);

  const checkDbStatus = async () => {
    setDbStatus('checking');
    try {
      const res = await fetch(`/api/health?t=${Date.now()}`);
      const contentType = res.headers.get("content-type");
      
      const isJson = contentType && contentType.includes("application/json");
      
      if (!isJson) {
        const text = await res.text();
        console.error("Non-JSON response body:", text.substring(0, 200));
        setDbStatus('error');
        if (text.includes('<!doctype html>') || text.includes('<html>')) {
          setDbError(`
            The server is returning a webpage instead of data. This usually happens if the backend failed to start.
            
            Please check:
            1. Secrets Panel: Do you have "POSTGRES_URL" set?
            2. Password: Did you replace [YOUR-PASSWORD] in the connection string?
            3. Supabase Status: Is your project active (not paused)?
            4. Network: Is "Allow all IP addresses" enabled in Supabase?
          `);
        } else {
          setDbError(`Server error (${res.status}): ${text.substring(0, 100)}`);
        }
        return;
      }

      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setDbStatus('connected');
        setDbError(null);
      } else {
        setDbStatus('error');
        setDbError(data.error || `Database Error (${res.status}): ${JSON.stringify(data)}`);
      }
    } catch (err: any) {
      setDbStatus('error');
      setDbError(`Connection failed: ${err.message}`);
    }
  };

  // Form states
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, view]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [refRes, hospRes, ngoRes, usersRes, doctorsRes] = await Promise.all([
        fetch(`/api/referrals?doctor_id=${user?.id}&hospital_id=${user?.hospital_id}&role=${user?.role}`),
        fetch('/api/hospitals'),
        fetch('/api/ngos'),
        (user?.role === 'ADMIN' || user?.role === 'HOSPITAL_ADMIN') ? fetch('/api/admin/users') : Promise.resolve(null),
        fetch('/api/doctors')
      ]);
      
      const refs = await refRes.json();
      const hosps = await hospRes.json();
      const ngoList = await ngoRes.json();
      const userList = usersRes ? await usersRes.json() : [];
      const doctorList = await doctorsRes.json();
      
      setReferrals(Array.isArray(refs) ? refs : []);
      setHospitals(Array.isArray(hosps) ? hosps : []);
      setNgos(Array.isArray(ngoList) ? ngoList : []);
      setUsers(Array.isArray(userList) ? userList : []);
      setAllDoctors(Array.isArray(doctorList) ? doctorList : []);
      
      if (user?.role === 'HOSPITAL_ADMIN' && user?.hospital_id) {
        fetchHospitalDetails(user.hospital_id);
      }
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      } else {
        setError('Invalid email or password');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  const handleCreateReferral = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    console.log("[Referral] handleCreateReferral triggered");
    
    try {
      if (!user?.id) {
        alert("CRITICAL ERROR: No User Session. Please log out and log in again.");
        return;
      }

      if (!referralFormPatientName.trim()) {
        alert("REQUIRED: Please enter the Patient Name.");
        return;
      }

      if (!referralFormPatientMobile.trim()) {
        alert("REQUIRED: Please enter the Mobile Number.");
        return;
      }

      if (!referralFormHospitalId) {
        alert("REQUIRED: Please select a Hospital.");
        return;
      }

      if (!referralFormSpecialty) {
        alert("REQUIRED: Please select or enter a Specialty.");
        return;
      }
      
      let specialist_name = '';
      if (referralFormDoctorId) {
        const doc = allDoctors.find(d => d.id === parseInt(referralFormDoctorId));
        if (doc) specialist_name = doc.name;
      }

      const hospitalIdNum = parseInt(referralFormHospitalId);
      const referringDoctorIdNum = parseInt(user.id.toString());

      const data = {
        patient_name: referralFormPatientName.trim(),
        patient_mobile: referralFormPatientMobile.trim(),
        hospital_id: hospitalIdNum,
        specialist_name: specialist_name || null,
        specialty: referralFormSpecialty.trim(),
        referring_doctor_id: referringDoctorIdNum
      };

      console.log("[Referral] Sending Payload:", data);
      setSubmitting(true);

      const res = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      const contentType = res.headers.get("content-type");
      let result;
      if (contentType && contentType.includes("application/json")) {
        result = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Server returned invalid response format. Status: ${res.status}`);
      }
      
      if (res.ok) {
        console.log("[Referral] SUCCESS:", result);
        alert("Referral created successfully!");
        
        // Reset form
        setReferralFormPatientName('');
        setReferralFormPatientMobile('');
        setReferralFormHospitalId('');
        setReferralFormSpecialty('');
        setReferralFormDoctorId('');
        setReferralFormSpecialties([]);
        
        setView('referrals');
      } else {
        console.error("[Referral] SERVER REJECTED:", result);
        let errorMsg = result.error || 'Unknown server error';
        if (result.detail) errorMsg += `\nDetail: ${result.detail}`;
        if (result.hint) errorMsg += `\nHint: ${result.hint}`;
        if (result.code) errorMsg += `\nCode: ${result.code}`;
        alert(`Failed to create referral: ${errorMsg}`);
      }
    } catch (err: any) {
      console.error("[Referral] Error:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateReferral = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedReferral) return;

    const formData = new FormData(e.currentTarget);
    const updates: any = {};
    formData.forEach((value, key) => {
      if (value) updates[key] = value;
    });

    try {
      const res = await fetch(`/api/referrals/${selectedReferral.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        setSelectedReferral(null);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHospitalDetails = async (hospitalId: number) => {
    try {
      const [specsRes, docsRes] = await Promise.all([
        fetch(`/api/hospitals/${hospitalId}/specializations`),
        fetch(`/api/hospitals/${hospitalId}/doctors`)
      ]);
      const specs = await specsRes.json();
      const docs = await docsRes.json();
      setHospitalSpecializations(Array.isArray(specs) ? specs : []);
      setHospitalDoctors(Array.isArray(docs) ? docs : []);
    } catch (err) {
      console.error("Failed to fetch hospital details", err);
    }
  };

  const onReferralDoctorChange = async (doctorId: string) => {
    setReferralFormDoctorId(doctorId);
    if (!doctorId) return;

    const doctor = allDoctors.find(d => d.id === parseInt(doctorId));
    if (doctor) {
      if (doctor.hospital_id) {
        setReferralFormHospitalId(doctor.hospital_id.toString());
        // Fetch specialties for this hospital
        try {
          const res = await fetch(`/api/hospitals/${doctor.hospital_id}/specializations`);
          const specs = await res.json();
          setReferralFormSpecialties(Array.isArray(specs) ? specs : []);
        } catch (err) {
          console.error(err);
        }
      }
      if (doctor.specialization) {
        setReferralFormSpecialty(doctor.specialization);
      }
    }
  };

  const onReferralHospitalChange = async (hospitalId: string) => {
    setReferralFormHospitalId(hospitalId);
    setReferralFormDoctorId('');
    setReferralFormSpecialty('');
    setReferralFormSpecialties([]);
    
    if (!hospitalId) return;

    try {
      const res = await fetch(`/api/hospitals/${hospitalId}/specializations`);
      const specs = await res.json();
      setReferralFormSpecialties(Array.isArray(specs) ? specs : []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDoctorDetail = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedDoctorData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHospitalDetail = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hospitals/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedHospitalData(data);
        fetchHospitalDetails(id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSpecialization = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user?.hospital_id) return;
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    
    try {
      const res = await fetch(`/api/hospitals/${user.hospital_id}/specializations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        fetchHospitalDetails(user.hospital_id);
        (e.target as HTMLFormElement).reset();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSpecialization = async (id: number) => {
    if (!window.confirm("Are you sure? This will also unlink doctors from this specialization.")) return;
    try {
      const res = await fetch(`/api/specializations/${id}`, { method: 'DELETE' });
      if (res.ok && user?.hospital_id) {
        fetchHospitalDetails(user.hospital_id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddDoctor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user?.hospital_id) return;
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    const photoFile = formData.get('profile_photo_file') as File;
    if (photoFile && photoFile.size > 0) {
      try {
        data.profile_photo = await fileToBase64(photoFile);
      } catch (err) {
        console.error("Failed to convert photo", err);
      }
    }
    delete data.profile_photo_file;

    // Get selected specializations
    const specialization_ids = formData.getAll('specialization_ids').map(id => parseInt(id as string));
    
    try {
      const res = await fetch(`/api/hospitals/${user.hospital_id}/doctors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, specialization_ids })
      });
      if (res.ok) {
        fetchHospitalDetails(user.hospital_id);
        (e.target as HTMLFormElement).reset();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to add doctor");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteDoctor = async (id: number) => {
    if (!window.confirm("Are you sure you want to remove this doctor?")) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok && user?.hospital_id) {
        fetchHospitalDetails(user.hospital_id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateHospital = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user?.hospital_id) return;
    
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    const photoFile = formData.get('profile_photo_file') as File;
    if (photoFile && photoFile.size > 0) {
      try {
        data.profile_photo = await fileToBase64(photoFile);
      } catch (err) {
        console.error("Failed to convert photo", err);
      }
    }
    delete data.profile_photo_file;
    
    try {
      const res = await fetch(`/api/hospitals/${user.hospital_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        fetchData();
        alert("Hospital profile updated successfully!");
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update hospital");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegisterUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    try {
      const res = await fetch('/api/admin/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        fetchData();
        (e.target as HTMLFormElement).reset();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to register user");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-brand-50 overflow-hidden">
              <img 
                src="https://nkuxpgrqwaeirrlljldf.supabase.co/storage/v1/object/public/img/Untitled%20design%20(9)-Photoroom.png" 
                alt="Clinzo Logo" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <p className="text-slate-500 text-sm">Referral Management Platform</p>
            
            <div className="mt-4 flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-100">
              <div className={`w-2 h-2 rounded-full ${
                dbStatus === 'connected' ? 'bg-brand-500 animate-pulse' : 
                dbStatus === 'error' ? 'bg-red-500' : 'bg-slate-300'
              }`} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Database: {dbStatus === 'connected' ? 'Connected' : dbStatus === 'error' ? 'Connection Error' : 'Checking...'}
              </span>
              {dbStatus === 'error' && (
                <button 
                  onClick={checkDbStatus}
                  className="ml-2 text-[10px] font-bold text-brand-600 hover:text-brand-700 underline uppercase tracking-wider"
                >
                  Retry
                </button>
              )}
            </div>
            {dbError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl max-w-xs">
                <p className="text-[10px] text-red-600 font-bold uppercase mb-1">Error Details</p>
                <p className="text-[10px] text-red-500 font-medium leading-relaxed">
                  {dbError}
                </p>
                {dbError.includes('missing') && (
                  <p className="mt-2 text-[10px] text-slate-600 italic">
                    Tip: Add POSTGRES_URL to the Secrets panel.
                  </p>
                )}
              </div>
            )}
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <input 
                type="email" 
                required
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                placeholder="doctor@clinic.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input 
                type="password" 
                required
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-red-500 text-xs text-center">{error}</p>}
            <button 
              type="submit"
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-xl shadow-md transition-all active:scale-[0.98]"
            >
              Sign In
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              This is a private, invite-only platform. 
              Contact your administrator for access.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-bottom border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm overflow-hidden border border-slate-100">
              <img 
                src="https://nkuxpgrqwaeirrlljldf.supabase.co/storage/v1/object/public/img/Untitled%20design%20(9)-Photoroom.png" 
                alt="Clinzo Logo" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 leading-tight">Clinzo</h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Connect</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <button 
            onClick={() => setView('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${view === 'dashboard' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          <button 
            onClick={() => setView('referrals')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${view === 'referrals' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <ClipboardList size={18} />
            Referrals
          </button>
          {user.role === 'ADMIN' && (
            <>
              <button 
                onClick={() => {
                  setView('hospitals');
                  setSelectedHospitalId(null);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${view === 'hospitals' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <HospitalIcon size={18} />
                Hospitals
              </button>
              <button 
                onClick={() => {
                  setView('doctors');
                  setSelectedDoctorId(null);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${view === 'doctors' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Stethoscope size={18} />
                Doctors
              </button>
              <button 
                onClick={() => setView('users')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${view === 'users' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Users size={18} />
                User Management
              </button>
            </>
          )}
          {user.role === 'DOCTOR' && (
            <button 
              onClick={() => setView('new-referral')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${view === 'new-referral' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <PlusCircle size={18} />
              New Referral
            </button>
          )}
          {user.role === 'HOSPITAL_ADMIN' && (
            <button 
              onClick={() => setView('hospital-profile')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${view === 'hospital-profile' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Building2 size={18} />
              Hospital Profile
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-2xl p-4 mb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Logged in as</p>
            <p className="text-sm font-bold text-slate-900 truncate">{user.name}</p>
            <p className="text-[10px] text-slate-500 font-medium">{user.role.replace('_', ' ')}</p>
          </div>
          <button 
            onClick={() => setUser(null)}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-all"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <h1 className="text-lg font-bold text-slate-900 capitalize">{view.replace('-', ' ')}</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search patients..." 
                className="pl-10 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all w-64"
              />
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {view === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <ClipboardList size={20} />
                      </div>
                      <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">+12%</span>
                    </div>
                    <p className="text-slate-500 text-sm font-medium">Total Referrals</p>
                    <p className="text-2xl font-bold text-slate-900">{Array.isArray(referrals) ? referrals.length : 0}</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                        <Clock size={20} />
                      </div>
                    </div>
                    <p className="text-slate-500 text-sm font-medium">Pending Updates</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {Array.isArray(referrals) ? referrals.filter(r => !['CASE_CLOSED', 'SURGERY_LOST', 'SURGERY_COMPLETED'].includes(r.status)).length : 0}
                    </p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-2 bg-brand-50 text-brand-600 rounded-lg">
                        <CheckCircle2 size={20} />
                      </div>
                    </div>
                    <p className="text-slate-500 text-sm font-medium">Completed Cases</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {Array.isArray(referrals) ? referrals.filter(r => r.status === 'CASE_CLOSED' || r.status === 'SURGERY_COMPLETED').length : 0}
                    </p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                        <TrendingUp size={20} />
                      </div>
                    </div>
                    <p className="text-slate-500 text-sm font-medium">Conversion Rate</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {Array.isArray(referrals) && referrals.length > 0 ? Math.round((referrals.filter(r => r.status === 'SURGERY_COMPLETED' || r.status === 'CASE_CLOSED').length / referrals.length) * 100) : 0}%
                    </p>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900">Recent Referrals</h3>
                    <button onClick={() => setView('referrals')} className="text-brand-600 text-sm font-semibold hover:underline">View All</button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {Array.isArray(referrals) && referrals.slice(0, 5).map(ref => (
                      <div key={ref.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold">
                            {ref.patient_name[0]}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{ref.patient_name}</p>
                            <p className="text-xs text-slate-500">to {ref.hospital_name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <StatusBadge status={ref.status} />
                          <p className="text-xs text-slate-400 font-medium">{new Date(ref.created_at).toLocaleDateString()}</p>
                          <ChevronRight size={16} className="text-slate-300" />
                        </div>
                      </div>
                    ))}
                    {referrals.length === 0 && (
                      <div className="p-12 text-center">
                        <p className="text-slate-400 text-sm">No referrals found.</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'referrals' && (
              <motion.div 
                key="referrals"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Patient</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Hospital</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Diagnosis</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cost/Discount</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Array.isArray(referrals) && referrals.map(ref => (
                        <tr key={ref.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-slate-900">{ref.patient_name}</p>
                            <p className="text-xs text-slate-500">{ref.patient_mobile}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-slate-700">{ref.hospital_name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">
                              {ref.specialist_name ? `${ref.specialist_name} • ${ref.specialty || 'General'}` : (ref.specialty || 'General')}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge status={ref.status} />
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs text-slate-600 line-clamp-1 max-w-[150px]">
                              {ref.diagnosis_summary || 'Pending update...'}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            {ref.package_cost ? (
                              <div>
                                <p className="text-sm font-bold text-slate-900">₹{ref.package_cost}</p>
                                <p className="text-[10px] text-brand-600 font-bold">Disc: ₹{ref.discount_value} ({ref.discount_allocation})</p>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400">Not entered</p>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <button 
                              onClick={() => setSelectedReferral(ref)}
                              className="text-brand-600 hover:text-brand-700 font-bold text-xs uppercase tracking-wider"
                            >
                              {user.role === 'DOCTOR' ? 'Edit' : 'Update'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {view === 'new-referral' && (
              <motion.div 
                key="new-referral"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-2xl mx-auto"
              >
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
                  <h2 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <PlusCircle className="text-brand-600" />
                    Create New Patient Referral
                  </h2>
                  <p className="text-sm text-slate-500 mb-6">
                    Referring Doctor: <span className="font-bold text-slate-700">{user?.name}</span>
                  </p>
                  <form onSubmit={handleCreateReferral} noValidate className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Patient Name</label>
                        <input 
                          value={referralFormPatientName}
                          onChange={(e) => setReferralFormPatientName(e.target.value)}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                          placeholder="Full Name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Mobile Number</label>
                        <input 
                          value={referralFormPatientMobile}
                          onChange={(e) => setReferralFormPatientMobile(e.target.value)}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                          placeholder="10-digit mobile"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Specialist Doctor (Optional)</label>
                        <select 
                          value={referralFormDoctorId}
                          onChange={(e) => onReferralDoctorChange(e.target.value)}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all appearance-none bg-white"
                        >
                          <option value="">Select Doctor</option>
                          {allDoctors.map(doc => (
                            <option key={doc.id} value={doc.id}>{doc.name} ({doc.specialization || 'General'})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Select Hospital</label>
                        <select 
                          value={referralFormHospitalId}
                          onChange={(e) => onReferralHospitalChange(e.target.value)}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all appearance-none bg-white"
                        >
                          <option value="">Select Hospital</option>
                          {hospitals.map(h => (
                            <option key={h.id} value={h.id}>{h.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Specialty (Mandatory)</label>
                      {referralFormSpecialties.length > 0 ? (
                        <select 
                          value={referralFormSpecialty}
                          onChange={(e) => setReferralFormSpecialty(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition-all appearance-none bg-white font-medium"
                        >
                          <option value="">Select Specialty</option>
                          {referralFormSpecialties.map(s => (
                            <option key={s.id} value={s.name}>{s.name}</option>
                          ))}
                        </select>
                      ) : (
                        <input 
                          value={referralFormSpecialty}
                          onChange={(e) => setReferralFormSpecialty(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition-all font-medium"
                          placeholder="Type Specialty (e.g. Cardiology, Orthopedics)"
                        />
                      )}
                      <p className="mt-1 text-xs text-slate-500 italic">
                        {referralFormSpecialties.length > 0 ? "Choose from hospital's departments" : "Type the department name manually"}
                      </p>
                    </div>

                    <div className="pt-4 flex gap-4">
                      <button 
                        type="button"
                        onClick={() => setView('dashboard')}
                        className="flex-1 px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        type="button"
                        disabled={submitting}
                        onClick={() => handleCreateReferral()}
                        className={`flex-1 text-white font-bold py-2.5 rounded-xl shadow-lg transition-all active:scale-[0.98] ${submitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 shadow-brand-100'}`}
                      >
                        {submitting ? 'Submitting...' : 'Submit Referral'}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}

            {view === 'hospitals' && user.role === 'ADMIN' && (
              <motion.div 
                key="hospitals"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {!selectedHospitalId ? (
                  <>
                    <div className="flex justify-between items-center">
                      <h2 className="text-xl font-bold text-slate-900">Registered Hospitals</h2>
                      <button className="bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-brand-100">
                        <PlusCircle size={18} />
                        Add Hospital
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {Array.isArray(hospitals) && hospitals.map(h => (
                        <div 
                          key={h.id} 
                          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                          onClick={() => {
                            setSelectedHospitalId(h.id);
                            fetchHospitalDetail(h.id);
                          }}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-brand-50 text-brand-600 rounded-xl group-hover:bg-brand-600 group-hover:text-white transition-colors">
                              <Building2 size={24} />
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{h.registration_number}</span>
                          </div>
                          <h3 className="font-bold text-slate-900 mb-1 group-hover:text-brand-600 transition-colors">{h.name}</h3>
                          <p className="text-sm text-slate-500 mb-4">{h.city}</p>
                          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                            <p className="text-xs font-medium text-slate-400">Contact: {h.contact_person || 'N/A'}</p>
                            <button className="text-brand-600 text-xs font-bold uppercase tracking-wider">View Profile</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="space-y-6">
                    <button 
                      onClick={() => setSelectedHospitalId(null)}
                      className="flex items-center gap-2 text-slate-500 hover:text-brand-600 transition-colors text-sm font-bold uppercase tracking-wider"
                    >
                      <ChevronRight size={16} className="rotate-180" />
                      Back to Hospitals
                    </button>
                    
                    {selectedHospitalData && (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1 space-y-6">
                          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
                            <div className="w-32 h-32 bg-slate-100 rounded-2xl mx-auto mb-4 overflow-hidden border border-slate-200 flex items-center justify-center">
                              {selectedHospitalData.profile_photo ? (
                                <img src={selectedHospitalData.profile_photo} alt={selectedHospitalData.name} className="w-full h-full object-cover" />
                              ) : (
                                <Building2 size={48} className="text-slate-300" />
                              )}
                            </div>
                            <h2 className="text-xl font-bold text-slate-900">{selectedHospitalData.name}</h2>
                            <p className="text-sm text-slate-500 mb-4">{selectedHospitalData.registration_number}</p>
                            <div className="flex flex-wrap justify-center gap-2">
                              {hospitalSpecializations.map(s => (
                                <span key={s.id} className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                  {s.name}
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Contact Information</h3>
                            <div className="space-y-3">
                              <div className="flex items-center gap-3 text-sm">
                                <MapPin size={16} className="text-slate-400" />
                                <span className="text-slate-600">{selectedHospitalData.address || 'No address provided'}</span>
                              </div>
                              <div className="flex items-center gap-3 text-sm">
                                <Users size={16} className="text-slate-400" />
                                <span className="text-slate-600">{selectedHospitalData.contact_person || 'N/A'} (Admin)</span>
                              </div>
                              <div className="flex items-center gap-3 text-sm">
                                <PlusCircle size={16} className="text-slate-400" />
                                <span className="text-slate-600">{selectedHospitalData.phone || 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="lg:col-span-2 space-y-6">
                          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                              <h3 className="font-bold text-slate-900">Hospital Doctors</h3>
                              <span className="px-2 py-1 bg-brand-50 text-brand-700 rounded-lg text-xs font-bold">{hospitalDoctors.length} Registered</span>
                            </div>
                            <div className="divide-y divide-slate-100">
                              {hospitalDoctors.map(doc => (
                                <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200">
                                      {doc.profile_photo ? (
                                        <img src={doc.profile_photo} alt={doc.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <Stethoscope size={20} className="text-slate-400" />
                                      )}
                                    </div>
                                    <div>
                                      <p className="font-bold text-slate-900 text-sm">{doc.name}</p>
                                      <p className="text-xs text-slate-500">{doc.qualifications || 'MBBS'}</p>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => {
                                      setView('doctors');
                                      setSelectedDoctorId(doc.id);
                                      fetchDoctorDetail(doc.id);
                                    }}
                                    className="text-brand-600 text-xs font-bold uppercase tracking-wider hover:underline"
                                  >
                                    View Profile
                                  </button>
                                </div>
                              ))}
                              {hospitalDoctors.length === 0 && (
                                <div className="p-8 text-center text-slate-400 italic text-sm">
                                  No doctors registered for this hospital yet.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {view === 'doctors' && user.role === 'ADMIN' && (
              <motion.div 
                key="doctors"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {!selectedDoctorId ? (
                  <>
                    <div className="flex justify-between items-center">
                      <h2 className="text-xl font-bold text-slate-900">Registered Doctors</h2>
                      <button 
                        onClick={() => setView('users')}
                        className="bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-brand-100"
                      >
                        <UserPlus size={18} />
                        Register New Doctor
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {users.filter(u => u.role === 'DOCTOR').map(doc => (
                        <div 
                          key={doc.id} 
                          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                          onClick={() => {
                            setSelectedDoctorId(doc.id);
                            fetchDoctorDetail(doc.id);
                          }}
                        >
                          <div className="flex items-center gap-4 mb-4">
                            <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition-colors overflow-hidden border border-slate-100">
                              {doc.profile_photo ? (
                                <img src={doc.profile_photo} alt={doc.name} className="w-full h-full object-cover" />
                              ) : (
                                <Stethoscope size={32} />
                              )}
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-900 group-hover:text-brand-600 transition-colors">{doc.name}</h3>
                              <p className="text-xs text-slate-500">{doc.qualifications || 'MBBS'}</p>
                            </div>
                          </div>
                          <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                              <Building2 size={14} className="text-slate-400" />
                              <span>{doc.hospital_name || 'Independent Practice'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                              <TrendingUp size={14} className="text-slate-400" />
                              <span>{doc.experience || 'N/A'} Experience</span>
                            </div>
                          </div>
                          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                              {doc.specialization || 'General'}
                            </span>
                            <button className="text-brand-600 text-xs font-bold uppercase tracking-wider">Profile</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="space-y-6">
                    <button 
                      onClick={() => setSelectedDoctorId(null)}
                      className="flex items-center gap-2 text-slate-500 hover:text-brand-600 transition-colors text-sm font-bold uppercase tracking-wider"
                    >
                      <ChevronRight size={16} className="rotate-180" />
                      Back to Doctors
                    </button>
                    
                    {selectedDoctorData && (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1 space-y-6">
                          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
                            <div className="w-32 h-32 bg-slate-100 rounded-2xl mx-auto mb-4 overflow-hidden border border-slate-200 flex items-center justify-center">
                              {selectedDoctorData.profile_photo ? (
                                <img src={selectedDoctorData.profile_photo} alt={selectedDoctorData.name} className="w-full h-full object-cover" />
                              ) : (
                                <Stethoscope size={48} className="text-slate-300" />
                              )}
                            </div>
                            <h2 className="text-xl font-bold text-slate-900">{selectedDoctorData.name}</h2>
                            <p className="text-sm text-brand-600 font-semibold mb-2">{selectedDoctorData.specialization || 'General Practice'}</p>
                            <p className="text-xs text-slate-500 mb-4">{selectedDoctorData.qualifications}</p>
                            
                            <div className="flex justify-center gap-4 pt-4 border-t border-slate-50">
                              <div className="text-center">
                                <p className="text-lg font-bold text-slate-900">{selectedDoctorData.experience || '0'}</p>
                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Years Exp.</p>
                              </div>
                              <div className="w-px h-8 bg-slate-100 my-auto" />
                              <div className="text-center">
                                <p className="text-lg font-bold text-slate-900">
                                  {referrals.filter(r => r.referring_doctor_id === selectedDoctorData.id).length}
                                </p>
                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Referrals</p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Contact Details</h3>
                            <div className="space-y-3">
                              <div className="flex items-center gap-3 text-sm">
                                <Users size={16} className="text-slate-400" />
                                <span className="text-slate-600">{selectedDoctorData.email}</span>
                              </div>
                              <div className="flex items-center gap-3 text-sm">
                                <PlusCircle size={16} className="text-slate-400" />
                                <span className="text-slate-600">{selectedDoctorData.phone || 'N/A'}</span>
                              </div>
                              <div className="flex items-center gap-3 text-sm">
                                <Building2 size={16} className="text-slate-400" />
                                <span className="text-slate-600">{selectedDoctorData.hospital_name || 'Independent'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="lg:col-span-2 space-y-6">
                          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100">
                              <h3 className="font-bold text-slate-900">Recent Referrals</h3>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-slate-50">
                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Patient</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hospital</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {referrals.filter(r => r.referring_doctor_id === selectedDoctorData.id).slice(0, 10).map(ref => (
                                    <tr key={ref.id} className="hover:bg-slate-50 transition-colors">
                                      <td className="px-6 py-4">
                                        <p className="text-sm font-bold text-slate-900">{ref.patient_name}</p>
                                        <p className="text-[10px] text-slate-500">{ref.patient_mobile}</p>
                                      </td>
                                      <td className="px-6 py-4 text-sm text-slate-600">{ref.hospital_name}</td>
                                      <td className="px-6 py-4"><StatusBadge status={ref.status} /></td>
                                      <td className="px-6 py-4 text-xs text-slate-500">{new Date(ref.created_at).toLocaleDateString()}</td>
                                    </tr>
                                  ))}
                                  {referrals.filter(r => r.referring_doctor_id === selectedDoctorData.id).length === 0 && (
                                    <tr>
                                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic text-sm">
                                        No referrals found for this doctor.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
            {view === 'users' && user.role === 'ADMIN' && (
              <motion.div 
                key="users"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Registration Form */}
                  <div className="lg:col-span-1">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <h2 className="text-xl font-bold text-slate-900 mb-6">Register New User</h2>
                      <form onSubmit={handleRegisterUser} className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Full Name</label>
                          <input 
                            name="name" 
                            required 
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                            placeholder="John Doe"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Email Address</label>
                          <input 
                            name="email" 
                            type="email" 
                            required 
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                            placeholder="john@example.com"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
                          <input 
                            name="password" 
                            type="password" 
                            required 
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                            placeholder="••••••••"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Phone Number</label>
                          <input 
                            name="phone" 
                            required 
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                            placeholder="+91 98765 43210"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Role</label>
                          <select 
                            name="role" 
                            required 
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                          >
                            <option value="DOCTOR">Doctor</option>
                            <option value="HOSPITAL_ADMIN">Hospital Admin</option>
                          </select>
                        </div>
                        <button 
                          type="submit"
                          className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-brand-100 transition-all active:scale-[0.98]"
                        >
                          Register User
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* User List */}
                  <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-slate-100">
                        <h2 className="text-xl font-bold text-slate-900">System Users</h2>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Role</th>
                              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Hospital</th>
                              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Phone</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {Array.isArray(users) && users.map(p => (
                              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                  <p className="text-sm font-bold text-slate-900">{p.name}</p>
                                  <p className="text-xs text-slate-500">{p.email}</p>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    p.role === 'ADMIN' ? 'bg-red-50 text-red-600 border-red-100' :
                                    p.role === 'DOCTOR' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                    'bg-brand-50 text-brand-600 border-brand-100'
                                  }`}>
                                    {p.role.replace('_', ' ')}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <p className="text-sm text-slate-600">{p.hospital_name || 'N/A'}</p>
                                </td>
                                <td className="px-6 py-4">
                                  <p className="text-sm text-slate-600">{p.phone || 'N/A'}</p>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            {view === 'hospital-profile' && user.role === 'HOSPITAL_ADMIN' && (
              <motion.div 
                key="hospital-profile"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                {(() => {
                  const myHospital = hospitals.find(h => h.id === user.hospital_id);
                  
                  if (!myHospital) return <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">Hospital data not found.</div>;
                  
                  return (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 overflow-hidden border border-brand-100 shadow-sm">
                            {myHospital.profile_photo ? (
                              <img src={myHospital.profile_photo} alt="Hospital" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Building2 size={32} />
                            )}
                          </div>
                          <div>
                            <h2 className="text-2xl font-bold text-slate-900">{myHospital.name}</h2>
                            <p className="text-slate-500">Hospital Profile Management</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex border-b border-slate-200">
                        <button 
                          onClick={() => setHospitalActiveTab('general')}
                          className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${hospitalActiveTab === 'general' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                          General Info
                        </button>
                        <button 
                          onClick={() => setHospitalActiveTab('specializations')}
                          className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${hospitalActiveTab === 'specializations' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                          Specializations
                        </button>
                        <button 
                          onClick={() => setHospitalActiveTab('doctors')}
                          className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${hospitalActiveTab === 'doctors' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                          Doctors
                        </button>
                      </div>

                      <div className="mt-6">
                        {hospitalActiveTab === 'general' && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                            <form onSubmit={handleUpdateHospital} className="space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                  <label className="block text-sm font-semibold text-slate-700 mb-2">Hospital Name</label>
                                  <input name="name" defaultValue={myHospital.name} required className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all" />
                                </div>
                                <div>
                                  <label className="block text-sm font-semibold text-slate-700 mb-2">Registration Number</label>
                                  <input name="registration_number" defaultValue={myHospital.registration_number} disabled className="w-full px-4 py-2 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 outline-none cursor-not-allowed" />
                                </div>
                                <div>
                                  <label className="block text-sm font-semibold text-slate-700 mb-2">Mobile Number</label>
                                  <input name="phone" defaultValue={myHospital.phone} required className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all" />
                                </div>
                                <div>
                                  <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
                                  <input name="email" type="email" defaultValue={myHospital.email} required className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all" />
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Hospital Address</label>
                                <textarea name="address" defaultValue={myHospital.address} rows={2} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all resize-none" />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Google Maps Link</label>
                                <div className="flex gap-2">
                                  <input name="google_maps_link" defaultValue={myHospital.google_maps_link} className="flex-1 px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all" placeholder="https://maps.google.com/..." />
                                  {myHospital.google_maps_link && (
                                    <a href={myHospital.google_maps_link} target="_blank" rel="noopener noreferrer" className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center"><MapPin size={20} /></a>
                                  )}
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Hospital Profile Photo</label>
                                <input 
                                  type="file"
                                  name="profile_photo_file" 
                                  accept="image/*"
                                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" 
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Upload a logo or photo for your hospital profile.</p>
                              </div>
                              <div className="pt-4">
                                <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-brand-100 transition-all active:scale-[0.98]">Save Changes</button>
                              </div>
                            </form>
                          </motion.div>
                        )}

                        {hospitalActiveTab === 'specializations' && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-1">
                              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <h3 className="font-bold text-slate-900 mb-4">Add Specialization</h3>
                                <form onSubmit={handleAddSpecialization} className="space-y-4">
                                  <input name="name" required className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all" placeholder="e.g. Cardiology" />
                                  <button type="submit" className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-2 rounded-xl transition-all">Add</button>
                                </form>
                              </div>
                            </div>
                            <div className="lg:col-span-2">
                              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-slate-100"><h3 className="font-bold text-slate-900">Current Specializations</h3></div>
                                <div className="divide-y divide-slate-100">
                                  {hospitalSpecializations.length === 0 ? (
                                    <div className="p-8 text-center text-slate-500 italic">No specializations added yet.</div>
                                  ) : (
                                    hospitalSpecializations.map(spec => (
                                      <div key={spec.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-all">
                                        <span className="font-medium text-slate-700">{spec.name}</span>
                                        <button onClick={() => handleDeleteSpecialization(spec.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={18} /></button>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {hospitalActiveTab === 'doctors' && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                              <div className="flex items-center gap-3 mb-6">
                                <UserPlus className="text-brand-600" />
                                <h3 className="font-bold text-slate-900 text-lg">Add New Doctor</h3>
                              </div>
                              <form onSubmit={handleAddDoctor} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                  <label className="block text-sm font-semibold text-slate-700 mb-2">Doctor Name</label>
                                  <input name="name" required className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all" placeholder="Dr. Jane Smith" />
                                </div>
                                <div>
                                  <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
                                  <input name="email" type="email" required className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all" placeholder="jane@hospital.com" />
                                </div>
                                <div>
                                  <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
                                  <input name="password" type="password" required className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all" placeholder="••••••••" />
                                </div>
                                <div>
                                  <label className="block text-sm font-semibold text-slate-700 mb-2">Phone Number</label>
                                  <input name="phone" required className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all" placeholder="+91 98765 43210" />
                                </div>
                                <div>
                                  <label className="block text-sm font-semibold text-slate-700 mb-2">Qualifications</label>
                                  <input name="qualifications" required className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all" placeholder="e.g. MBBS, MD" />
                                </div>
                                <div>
                                  <label className="block text-sm font-semibold text-slate-700 mb-2">Experience</label>
                                  <input name="experience" required className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all" placeholder="e.g. 10+ years" />
                                </div>
                                <div>
                                  <label className="block text-sm font-semibold text-slate-700 mb-2">Doctor Profile Photo</label>
                                  <input 
                                    type="file"
                                    name="profile_photo_file" 
                                    accept="image/*"
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" 
                                  />
                                </div>
                                <div className="md:col-span-2">
                                  <label className="block text-sm font-semibold text-slate-700 mb-2">Select Specializations</label>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {hospitalSpecializations.map(spec => (
                                      <label key={spec.id} className="flex items-center gap-2 p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-brand-50 cursor-pointer transition-all">
                                        <input type="checkbox" name="specialization_ids" value={spec.id} className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500" />
                                        <span className="text-sm font-medium text-slate-700">{spec.name}</span>
                                      </label>
                                    ))}
                                  </div>
                                  {hospitalSpecializations.length === 0 && <p className="text-xs text-red-500 mt-2">Please add specializations first.</p>}
                                </div>
                                <div className="md:col-span-2 pt-2">
                                  <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-brand-100 transition-all active:scale-[0.98]">Add Doctor</button>
                                </div>
                              </form>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="font-bold text-slate-900">Registered Doctors</h3>
                                <span className="px-3 py-1 bg-brand-50 text-brand-600 text-xs font-bold rounded-full">{hospitalDoctors.length} Total</span>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Doctor</th>
                                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Qualifications & Exp</th>
                                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Specializations</th>
                                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Contact</th>
                                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {hospitalDoctors.map(doc => (
                                      <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                          <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center text-brand-600 font-bold overflow-hidden border border-brand-100">
                                              {doc.profile_photo ? (
                                                <img src={doc.profile_photo} alt={doc.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                              ) : (
                                                doc.name.charAt(0)
                                              )}
                                            </div>
                                            <div><p className="text-sm font-bold text-slate-900">{doc.name}</p><p className="text-xs text-slate-500">{doc.email}</p></div>
                                          </div>
                                        </td>
                                        <td className="px-6 py-4">
                                          <p className="text-sm font-medium text-slate-700">{doc.qualifications || 'N/A'}</p>
                                          <p className="text-xs text-slate-500">{doc.experience || 'N/A'}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                          <div className="flex flex-wrap gap-1">
                                            {doc.specializations?.map(s => (
                                              <span key={s.id} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full border border-blue-100">{s.name}</span>
                                            ))}
                                            {(!doc.specializations || doc.specializations.length === 0) && <span className="text-xs text-slate-400 italic">None</span>}
                                          </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{doc.phone}</td>
                                        <td className="px-6 py-4">
                                          <button onClick={() => handleDeleteDoctor(doc.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={18} /></button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {hospitalDoctors.length === 0 && <div className="p-12 text-center text-slate-500 italic">No doctors registered yet.</div>}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Update Modal */}
      <AnimatePresence>
        {selectedReferral && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedReferral(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {user.role === 'DOCTOR' ? 'Edit Referral' : 'Update Referral Status'}
                  </h2>
                  <p className="text-sm text-slate-500">Patient: {selectedReferral.patient_name}</p>
                </div>
                <button onClick={() => setSelectedReferral(null)} className="text-slate-400 hover:text-slate-600">
                  <AlertCircle size={24} />
                </button>
              </div>

              <form onSubmit={handleUpdateReferral} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                {user.role === 'DOCTOR' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Patient Name</label>
                      <input 
                        name="patient_name"
                        defaultValue={selectedReferral.patient_name}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Hospital</label>
                      <select 
                        name="hospital_id"
                        defaultValue={selectedReferral.hospital_id}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                      >
                        {hospitals.map(h => (
                          <option key={h.id} value={h.id}>{h.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Current Status</label>
                        <select 
                          name="status"
                          defaultValue={selectedReferral.status}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                        >
                          <option value="CREATED">Created</option>
                          <option value="ARRIVED">Arrived</option>
                          <option value="MEDICATION_DONE">Medication Done</option>
                          <option value="PACKAGE_PROPOSAL">Package Proposal</option>
                          <option value="SURGERY_RECOMMENDED">Surgery Recommended</option>
                          <option value="SURGERY_SCHEDULED">Surgery Scheduled</option>
                          <option value="FOLLOW_UP_SURGERY">Follow-Up Surgery</option>
                          <option value="SURGERY_LOST">Surgery Lost</option>
                          <option value="SURGERY_COMPLETED">Surgery Completed</option>
                          <option value="SCHEDULED">Scheduled</option>
                          <option value="FOLLOW_UP">Follow Up</option>
                          <option value="REVISIT">Revisit</option>
                          <option value="CASE_CLOSED">Case Closed</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Surgery Date (if applicable)</label>
                        <input 
                          type="date"
                          name="surgery_date"
                          defaultValue={selectedReferral.surgery_date}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Diagnosis Summary</label>
                      <textarea 
                        name="diagnosis_summary"
                        defaultValue={selectedReferral.diagnosis_summary}
                        rows={3}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                        placeholder="Enter diagnosis details..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Package Cost (₹)</label>
                        <input 
                          type="number"
                          name="package_cost"
                          defaultValue={selectedReferral.package_cost}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Discount (₹)</label>
                        <input 
                          type="number"
                          name="discount_value"
                          defaultValue={selectedReferral.discount_value}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Allocation</label>
                        <select 
                          name="discount_allocation"
                          defaultValue={selectedReferral.discount_allocation || 'PATIENT'}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none text-sm bg-white"
                        >
                          <option value="PATIENT">Patient</option>
                          <option value="NGO">NGO</option>
                          <option value="RETAINED">Retained</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                        <HeartHandshake size={16} className="text-brand-600" />
                        Select NGO (if allocation is NGO)
                      </label>
                      <select 
                        name="ngo_id"
                        defaultValue={selectedReferral.ngo_id || ''}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                      >
                        <option value="">None</option>
                        {Array.isArray(ngos) && ngos.map(n => (
                          <option key={n.id} value={n.id}>{n.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setSelectedReferral(null)}
                    className="flex-1 px-6 py-3 rounded-2xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-2xl shadow-xl shadow-brand-100 transition-all active:scale-[0.98]"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
