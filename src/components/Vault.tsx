import { useState, useEffect, useCallback } from 'react';
import { encryptVault, generateIV, decryptBytes, encryptBytes } from '../crypto/encryption';
import { deriveUserKey, clearBuffer } from '../crypto/keyDerivation';
import { computeFinalKey } from '../crypto/hash';
import { bufferToBase64, base64ToBuffer } from '../utils/base64';
import { saveVault, loadVault, firebaseLogout } from '../storage/vaultStorage';
import { isFirebaseConfigured } from '../firebase/config';
import PasswordGenerator from './PasswordGenerator';
import { Search, Plus, LogOut, Copy, Edit2, Trash2, Eye, EyeOff, Save, X, KeyRound, Lock } from 'lucide-react';

const CATEGORIES = ['All', 'Social', 'Finance', 'Work', 'Email', 'Other'];
const CATEGORY_COLORS: Record<string, string> = { Social: 'text-[#58a6ff] bg-[#58a6ff]/10 border-[#58a6ff]/30', Finance: 'text-[#2ea043] bg-[#2ea043]/10 border-[#2ea043]/30', Work: 'text-[#d29922] bg-[#d29922]/10 border-[#d29922]/30', Email: 'text-[#bc8cff] bg-[#bc8cff]/10 border-[#bc8cff]/30', Other: 'text-[#8b949e] bg-[#8b949e]/10 border-[#8b949e]/30' };

function validatePasswordStrength(password: string) {
    if (password.length < 12) return 'Master password must be at least 12 characters.';
    if (!/[A-Z]/.test(password)) return 'Master password must contain at least one uppercase letter.';
    if (!/[a-z]/.test(password)) return 'Master password must contain at least one lowercase letter.';
    if (!/[0-9]/.test(password)) return 'Master password must contain at least one digit.';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Master password must contain at least one special character.';
    return null;
}

function SiteFavicon({ site }: { site: string }) {
    const [imgError, setImgError] = useState(false);
    let domain = site;
    try { if (site.includes('.')) domain = site.replace(/^https?:\/\//, '').split('/')[0]; } catch { /* ignore */ }
    if (imgError || !site.includes('.')) {
        const hue = site.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;
        return <div style={{ background: `hsl(${hue}, 60%, 35%)` }} className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold text-white shrink-0 shadow-inner">{site.charAt(0).toUpperCase()}</div>;
    }
    return <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt="" className="w-10 h-10 rounded-xl shrink-0 bg-white/5 object-contain p-1" onError={() => setImgError(true)} />;
}

export default function Vault({ userInfo, initialVault, firebaseData: initialFirebaseData, onLogout, toast }: any) {
    const userId = userInfo.userId;
    const displayName = userInfo.displayName;

    const [vault, setVault] = useState<any>(initialVault);
    const [fbData, setFbData] = useState<any>(initialFirebaseData);
    const [isAdding, setIsAdding] = useState(false);
    const [site, setSite] = useState('');
    const [user, setUser] = useState('');
    const [pass, setPass] = useState('');
    const [category, setCategory] = useState('Other');
    const [visiblePassId, setVisiblePassId] = useState<number | null>(null);
    const [showGenerator, setShowGenerator] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editSite, setEditSite] = useState('');
    const [editUser, setEditUser] = useState('');
    const [editPass, setEditPass] = useState('');
    const [editCategory, setEditCategory] = useState('Other');
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [modalPassword, setModalPassword] = useState('');
    const [pendingVault, setPendingVault] = useState<any>(null);
    const [pendingAction, setPendingAction] = useState('');
    const [saving, setSaving] = useState(false);

    // Change Master Password State
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);

    useEffect(() => {
        if (visiblePassId !== null) {
            const timer = setTimeout(() => setVisiblePassId(null), 8000);
            return () => clearTimeout(timer);
        }
    }, [visiblePassId]);

    const handleChangeMasterPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!oldPassword || !newPassword) return toast.warning('Please enter both passwords.');
        const strengthError = validatePasswordStrength(newPassword);
        if (strengthError) return toast.warning(strengthError);
        
        setChangingPassword(true);
        try {
            // 1. Verify old password
            const oldSalt = base64ToBuffer(fbData.salt);
            const wrappedServerKey = base64ToBuffer(fbData.wrappedServerKey);
            const wrappedServerKeyIv = base64ToBuffer(fbData.wrappedServerKeyIv);

            const kUserOld = await deriveUserKey(oldPassword, oldSalt);
            let serverKey;
            try {
                serverKey = await decryptBytes(wrappedServerKey, kUserOld, wrappedServerKeyIv);
            } catch {
                throw new Error('Old Master Password is incorrect.');
            }

            // 2. Encrypt everything with the NEW password
            const newSalt = window.crypto.getRandomValues(new Uint8Array(16));
            const kUserNew = await deriveUserKey(newPassword, newSalt);
            const kFinalNew = await computeFinalKey(kUserNew, serverKey);

            const newIv = generateIV();
            const encryptedVaultBuffer = await encryptVault(JSON.stringify(vault), kFinalNew, newIv);

            const newWrappedServerKeyIv = generateIV();
            const newWrappedServerKey = await encryptBytes(serverKey, kUserNew, newWrappedServerKeyIv);

            clearBuffer(kUserOld);
            clearBuffer(kUserNew);
            clearBuffer(serverKey);
            clearBuffer(kFinalNew);

            // 3. Save to Firebase
            await saveVault(userId, {
                salt: bufferToBase64(newSalt),
                wrappedServerKey: bufferToBase64(newWrappedServerKey),
                wrappedServerKeyIv: bufferToBase64(newWrappedServerKeyIv),
                iv: bufferToBase64(newIv),
                encryptedVault: bufferToBase64(encryptedVaultBuffer),
            });

            const refreshedData = await loadVault(userId);
            setFbData(refreshedData);
            setShowChangePasswordModal(false);
            setOldPassword('');
            setNewPassword('');
            toast.success('Master Password changed successfully!');
        } catch (err: any) {
            toast.error(err.message || 'Failed to change Master Password.');
        } finally {
            setChangingPassword(false);
        }
    };

    const saveVaultData = useCallback(async (newVault: any, masterPassword: string, action: string) => {
        setSaving(true);
        try {
            const salt = base64ToBuffer(fbData.salt);
            const wrappedServerKey = base64ToBuffer(fbData.wrappedServerKey);
            const wrappedServerKeyIv = base64ToBuffer(fbData.wrappedServerKeyIv);

            const kUser = await deriveUserKey(masterPassword, salt);
            const serverKey = await decryptBytes(wrappedServerKey, kUser, wrappedServerKeyIv);
            const kFinal = await computeFinalKey(kUser, serverKey);

            const newIv = generateIV();
            const encryptedVaultBuffer = await encryptVault(JSON.stringify(newVault), kFinal, newIv);

            const newWrappedServerKeyIv = generateIV();
            const newWrappedServerKey = await encryptBytes(serverKey, kUser, newWrappedServerKeyIv);

            clearBuffer(kUser);
            clearBuffer(serverKey);
            clearBuffer(kFinal);

            await saveVault(userId, {
                salt: fbData.salt,
                wrappedServerKey: bufferToBase64(newWrappedServerKey),
                wrappedServerKeyIv: bufferToBase64(newWrappedServerKeyIv),
                iv: bufferToBase64(newIv),
                encryptedVault: bufferToBase64(encryptedVaultBuffer),
            });

            const refreshedData = await loadVault(userId);
            setFbData(refreshedData);
            setVault(newVault);

            const actionMessages: any = { add: 'Password added & encrypted!', delete: 'Password deleted & vault re-encrypted!', edit: 'Password updated & re-encrypted!' };
            toast.success(actionMessages[action] || 'Vault saved!');
        } catch (err: any) {
            toast.error(`Save failed: ${err.message}`);
        } finally {
            setSaving(false);
        }
    }, [fbData, userId, toast]);

    const requestSave = (newVault: any, action: string) => {
        setPendingVault(newVault);
        setPendingAction(action);
        setModalPassword('');
        setShowPasswordModal(true);
    };

    const handleAddItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!site || !user || !pass) return toast.warning('Please fill in all fields.');
        const newItem = { id: Date.now(), site, username: user, password: pass, category, createdAt: Date.now() };
        const newVault = { ...vault, items: [...vault.items, newItem] };
        setIsAdding(false); setSite(''); setUser(''); setPass(''); setCategory('Other');
        requestSave(newVault, 'add');
    };

    const handleDeleteItem = (itemId: number) => requestSave({ ...vault, items: vault.items.filter((item: any) => item.id !== itemId) }, 'delete');
    const handleStartEdit = (item: any) => { setEditingId(item.id); setEditSite(item.site); setEditUser(item.username); setEditPass(item.password); setEditCategory(item.category || 'Other'); };

    const handleSaveEdit = () => {
        if (!editSite || !editUser || !editPass) return toast.warning('All fields are required.');
        const newVault = { ...vault, items: vault.items.map((item: any) => item.id === editingId ? { ...item, site: editSite, username: editUser, password: editPass, category: editCategory } : item) };
        setEditingId(null);
        requestSave(newVault, 'edit');
    };

    const handleConfirmSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!modalPassword) return;
        setShowPasswordModal(false);
        await saveVaultData(pendingVault, modalPassword, pendingAction);
        setModalPassword(''); setPendingVault(null); setPendingAction('');
    };

    const handleCopyPassword = async (password: string, siteName: string) => {
        try {
            await navigator.clipboard.writeText(password);
            toast.success(`Password for ${siteName} copied!`);
        } catch { toast.error('Failed to copy password.'); }
    };

    const handleLogout = async () => {
        if (isFirebaseConfigured) { try { await firebaseLogout(); } catch { /* ignore */ } }
        onLogout();
    };

    const filteredItems = vault.items.filter((item: any) => {
        const matchesSearch = !searchQuery || item.site.toLowerCase().includes(searchQuery.toLowerCase()) || item.username.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = activeCategory === 'All' || (item.category || 'Other') === activeCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="flex flex-col h-full animate-fade-in">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-[#0d1117]/80 backdrop-blur-xl border-b border-white/5 px-4 sm:px-6 py-4 flex flex-row items-center justify-between gap-2 sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 bg-primary/20 rounded-lg border border-primary/30">
                        <KeyRound className="text-primary w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">My Vault</h2>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                        <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
                        <span className="text-sm font-medium text-[#c9d1d9]">{displayName}</span>
                    </div>
                    <button 
                        onClick={() => setShowChangePasswordModal(true)} 
                        className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-4 sm:py-2 bg-white/5 text-[#c9d1d9] border border-white/10 hover:bg-white/10 hover:border-white/20 rounded-lg transition-all text-xs sm:text-sm font-medium"
                        title="Change Master Password"
                    >
                        <Lock size={14} className="sm:w-4 sm:h-4" />
                        <span className="hidden md:inline">Change Password</span>
                    </button>
                    <button 
                        onClick={handleLogout} 
                        className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-4 sm:py-2 bg-[#f85149]/10 text-[#f85149] border border-[#f85149]/20 hover:bg-[#f85149]/20 hover:border-[#f85149]/40 rounded-lg transition-all text-xs sm:text-sm font-medium"
                        title="Lock & Logout"
                    >
                        <LogOut size={14} className="sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">Lock & Logout</span>
                    </button>
                </div>
            </header>

            <div className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
                {showGenerator && (
                    <div className="mb-6">
                        <PasswordGenerator 
                            onUsePassword={(pw: string) => { setPass(pw); setShowGenerator(false); if (!isAdding) setIsAdding(true); }} 
                            onClose={() => setShowGenerator(false)} 
                        />
                    </div>
                )}

                {/* Toolbar */}
                <div className="bg-[#161b22]/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 sm:p-5 mb-6 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between shadow-lg">
                    <div className="flex items-center gap-4 flex-1">
                        <h3 className="text-lg font-semibold text-white whitespace-nowrap">Passwords ({filteredItems.length})</h3>
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e] w-4 h-4" />
                            <input 
                                type="text" 
                                placeholder="Search vault..." 
                                className="w-full pl-10 pr-4 py-2 bg-[#0d1117] border border-white/10 rounded-xl text-white placeholder-[#8b949e] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all text-sm"
                                value={searchQuery} 
                                onChange={e => setSearchQuery(e.target.value)} 
                            />
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setShowGenerator(!showGenerator)} 
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-[#c9d1d9] rounded-xl transition-all font-medium text-sm"
                        >
                            <KeyRound size={16} />
                            Generate
                        </button>
                        <button 
                            onClick={() => setIsAdding(!isAdding)} 
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-[#3182ce] text-white border border-primary/50 rounded-xl transition-all font-medium text-sm shadow-[0_0_15px_rgba(88,166,255,0.2)]"
                        >
                            {isAdding ? <X size={16} /> : <Plus size={16} />}
                            {isAdding ? 'Cancel' : 'Add Password'}
                        </button>
                    </div>
                </div>

                {/* Categories */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {CATEGORIES.map(cat => (
                        <button 
                            key={cat} 
                            onClick={() => setActiveCategory(cat)} 
                            className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all border ${
                                activeCategory === cat 
                                    ? (CATEGORY_COLORS[cat] || 'bg-primary/20 text-primary border-primary/40') 
                                    : 'bg-transparent text-[#8b949e] border-transparent hover:bg-white/5'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Add Form */}
                {isAdding && (
                    <div className="bg-[#161b22]/60 backdrop-blur-md border border-primary/30 rounded-2xl p-5 mb-6 shadow-[0_0_20px_rgba(88,166,255,0.1)] animate-fade-in">
                        <form onSubmit={handleAddItem} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <input type="text" placeholder="Website / App" className="w-full px-4 py-2.5 bg-[#0d1117] border border-white/10 rounded-xl text-white focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all text-sm" value={site} onChange={e => setSite(e.target.value)} autoFocus />
                                <input type="text" placeholder="Username or Email" className="w-full px-4 py-2.5 bg-[#0d1117] border border-white/10 rounded-xl text-white focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all text-sm" value={user} onChange={e => setUser(e.target.value)} />
                                <input type="password" placeholder="Password" className="w-full px-4 py-2.5 bg-[#0d1117] border border-white/10 rounded-xl text-white focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all text-sm" value={pass} onChange={e => setPass(e.target.value)} />
                                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-4 py-2.5 bg-[#0d1117] border border-white/10 rounded-xl text-white focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all text-sm appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%238b949e%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:10px_10px] bg-[right_14px_center] pr-10">
                                    {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c} className="bg-[#161b22] text-white">{c}</option>)}
                                </select>
                            </div>
                            <div className="flex justify-end">
                                <button type="submit" className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-[#3182ce] text-white font-medium rounded-xl transition-all shadow-md border border-primary/50">
                                    <Save size={16} /> Encrypt & Save
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Password List */}
                <div className="bg-[#161b22]/40 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                    {filteredItems.length === 0 ? (
                        <div className="p-16 text-center flex flex-col items-center">
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-[#8b949e] mb-4">
                                <Search size={32} />
                            </div>
                            <p className="text-lg font-medium text-[#c9d1d9]">{vault.items.length === 0 ? 'Your vault is empty' : 'No passwords match'}</p>
                            <p className="text-sm text-[#8b949e] mt-1">{vault.items.length === 0 ? 'Click "Add Password" to get started.' : 'Try adjusting your search or category filters.'}</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {filteredItems.map((item: any) => (
                                <div key={item.id} className="p-4 sm:p-5 hover:bg-white/[0.02] transition-colors group">
                                    {editingId === item.id ? (
                                        <div className="w-full animate-fade-in">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                                                <input type="text" className="w-full px-3 py-2 bg-[#0d1117] border border-white/10 rounded-lg text-white focus:border-primary text-sm" value={editSite} onChange={e => setEditSite(e.target.value)} />
                                                <input type="text" className="w-full px-3 py-2 bg-[#0d1117] border border-white/10 rounded-lg text-white focus:border-primary text-sm" value={editUser} onChange={e => setEditUser(e.target.value)} />
                                                <input type="text" className="w-full px-3 py-2 bg-[#0d1117] border border-white/10 rounded-lg text-white focus:border-primary text-sm" value={editPass} onChange={e => setEditPass(e.target.value)} />
                                                <select className="w-full px-3 py-2 bg-[#0d1117] border border-white/10 rounded-lg text-white focus:border-primary text-sm" value={editCategory} onChange={e => setEditCategory(e.target.value)}>
                                                    {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex gap-2 justify-end">
                                                <button onClick={() => setEditingId(null)} className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm transition-colors border border-white/10">Cancel</button>
                                                <button onClick={handleSaveEdit} className="px-4 py-1.5 bg-success/20 hover:bg-success/30 text-success rounded-lg text-sm font-medium transition-colors border border-success/30 flex items-center gap-1.5"><Save size={14}/> Save</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                                            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                                                <SiteFavicon site={item.site} />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-semibold text-white text-base truncate">{item.site}</h4>
                                                        {item.category && item.category !== 'Other' && (
                                                            <span className="hidden sm:inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[#8b949e]">{item.category}</span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-[#8b949e] truncate mt-0.5">{item.username}</p>
                                                    
                                                    <div className={`mt-2 font-mono text-xs sm:text-sm tracking-widest text-primary bg-[#0d1117]/80 inline-block px-2 sm:px-3 py-1 rounded-md border border-white/5 transition-all duration-300 overflow-hidden ${visiblePassId === item.id ? 'opacity-100 max-h-10' : 'opacity-0 max-h-0 !py-0 !mt-0 !border-transparent'}`}>
                                                        {item.password}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-end gap-1 sm:gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                                                <button onClick={() => setVisiblePassId(visiblePassId === item.id ? null : item.id)} className="p-2 sm:p-2 hover:bg-white/10 text-[#8b949e] hover:text-white rounded-lg transition-colors border border-transparent hover:border-white/10" title={visiblePassId === item.id ? "Hide Password" : "Show Password"}>
                                                    {visiblePassId === item.id ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                                <button onClick={() => handleCopyPassword(item.password, item.site)} className="p-2 sm:p-2 hover:bg-primary/20 text-[#8b949e] hover:text-primary rounded-lg transition-colors border border-transparent hover:border-primary/20" title="Copy Password">
                                                    <Copy size={16} />
                                                </button>
                                                <button onClick={() => handleStartEdit(item)} className="p-2 sm:p-2 hover:bg-white/10 text-[#8b949e] hover:text-white rounded-lg transition-colors border border-transparent hover:border-white/10" title="Edit">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleDeleteItem(item.id)} className="p-2 sm:p-2 hover:bg-[#f85149]/20 text-[#8b949e] hover:text-[#f85149] rounded-lg transition-colors border border-transparent hover:border-[#f85149]/20" title="Delete">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Confirm Save Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-[#161b22] border border-white/10 rounded-2xl p-8 max-w-sm w-full shadow-2xl">
                        <div className="w-12 h-12 rounded-full bg-warning/20 text-warning flex items-center justify-center mb-5 border border-warning/30">
                            <Lock size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Confirm Encryption</h3>
                        <p className="text-sm text-[#8b949e] mb-6">Enter your Master Password to securely encrypt these changes.</p>
                        <form onSubmit={handleConfirmSave}>
                            <input 
                                type="password" 
                                placeholder="Master Password" 
                                className="w-full px-4 py-3 bg-[#0d1117] border border-white/10 rounded-xl text-white mb-6 focus:border-warning focus:ring-1 focus:ring-warning/50 transition-all" 
                                value={modalPassword} 
                                onChange={(e) => setModalPassword(e.target.value)} 
                                autoFocus 
                            />
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setShowPasswordModal(false)} className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors font-medium text-sm border border-white/10">Cancel</button>
                                <button type="submit" disabled={saving} className="flex-1 py-3 px-4 bg-warning hover:bg-[#b07d1a] text-white rounded-xl transition-colors font-medium text-sm shadow-md disabled:opacity-50">
                                    {saving ? 'Encrypting...' : 'Encrypt'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Change Master Password Modal */}
            {showChangePasswordModal && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-[#161b22] border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl">
                        <div className="flex justify-between items-center mb-5">
                            <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center border border-primary/30">
                                <KeyRound size={24} />
                            </div>
                            <button onClick={() => setShowChangePasswordModal(false)} className="text-[#8b949e] hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Change Master Password</h3>
                        <p className="text-sm text-[#8b949e] mb-6">Your entire vault will be re-encrypted with your new Master Password.</p>
                        <form onSubmit={handleChangeMasterPassword} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-[#8b949e] mb-1 ml-1">Current Password</label>
                                <input 
                                    type="password" 
                                    className="w-full px-4 py-3 bg-[#0d1117] border border-white/10 rounded-xl text-white focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all text-sm" 
                                    value={oldPassword} 
                                    onChange={(e) => setOldPassword(e.target.value)} 
                                    autoFocus 
                                    disabled={changingPassword}
                                />
                            </div>
                            <div className="mb-6">
                                <label className="block text-xs font-medium text-[#8b949e] mb-1 ml-1">New Password (Min 12 chars)</label>
                                <input 
                                    type="password" 
                                    className="w-full px-4 py-3 bg-[#0d1117] border border-white/10 rounded-xl text-white focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all text-sm" 
                                    value={newPassword} 
                                    onChange={(e) => setNewPassword(e.target.value)} 
                                    disabled={changingPassword}
                                />
                            </div>
                            <button 
                                type="submit" 
                                disabled={changingPassword || !oldPassword || !newPassword} 
                                className="w-full py-3.5 px-4 bg-primary hover:bg-[#3182ce] text-white rounded-xl transition-all font-medium shadow-md disabled:opacity-50 border border-primary/50"
                            >
                                {changingPassword ? 'Re-encrypting Vault...' : 'Change Password & Re-encrypt'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
