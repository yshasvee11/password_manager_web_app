import { useState, useCallback } from 'react';
import AuthCard from './components/AuthCard';
import Vault from './components/Vault';
import { ToastContainer, useToast } from './components/Toast';
import useAutoLock from './hooks/useAutoLock';

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [activeUser, setActiveUser] = useState<any>(null);
    const [decryptedVault, setDecryptedVault] = useState<any>(null);
    const [firebaseData, setFirebaseData] = useState<any>(null);
    const { toasts, removeToast, toast } = useToast();

    const handleLoginSuccess = (userInfo: any, vault: any, fbData: any) => {
        setActiveUser(userInfo);
        setDecryptedVault(vault);
        setFirebaseData(fbData);
        setIsAuthenticated(true);
        toast.success(`Welcome back, ${userInfo.displayName}!`);
    };

    const handleLogout = useCallback(() => {
        if (decryptedVault && decryptedVault.items) {
            decryptedVault.items.forEach((item: any) => {
                item.site = null;
                item.username = null;
                item.password = null;
            });
        }
        setIsAuthenticated(false);
        setActiveUser(null);
        setDecryptedVault(null);
        setFirebaseData(null);
    }, [decryptedVault]);

    const handleAutoLock = useCallback(() => {
        toast.warning('Vault locked due to inactivity.');
        handleLogout();
    }, [handleLogout, toast]);

    const { showWarning, secondsLeft } = useAutoLock(isAuthenticated ? handleAutoLock : () => {});

    return (
        <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9] font-sans antialiased selection:bg-primary/30">
            {/* Background Gradients */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-primary/10 blur-[120px] rounded-full mix-blend-screen" />
                <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-primary/5 blur-[120px] rounded-full mix-blend-screen" />
            </div>

            <div className="relative z-10 flex flex-col min-h-screen">
                <ToastContainer toasts={toasts} onDismiss={removeToast} />
                
                {isAuthenticated && showWarning && (
                    <div className="fixed top-0 left-0 right-0 z-[9998] bg-warning/20 backdrop-blur-md border-b border-warning/40 px-5 py-2.5 text-center text-warning text-sm font-medium shadow-lg animate-fade-in">
                        Vault will auto-lock in <strong className="font-bold text-white">{secondsLeft}s</strong> due to inactivity.
                    </div>
                )}

                <main className="flex-1 flex flex-col">
                    {!isAuthenticated ? (
                        <AuthCard onLoginSuccess={handleLoginSuccess} toast={toast} />
                    ) : (
                        <Vault
                            userInfo={activeUser}
                            initialVault={decryptedVault}
                            firebaseData={firebaseData}
                            onLogout={handleLogout}
                            toast={toast}
                        />
                    )}
                </main>
            </div>
        </div>
    );
}

export default App;
