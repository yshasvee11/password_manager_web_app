import React, { useState, useCallback, useEffect } from 'react';
import { Copy, RefreshCw, X, Check } from 'lucide-react';

const CHAR_SETS = {
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    digits: '0123456789',
    special: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

function generatePassword(length: number, options: any) {
    let charset = '';
    if (options.lowercase) charset += CHAR_SETS.lowercase;
    if (options.uppercase) charset += CHAR_SETS.uppercase;
    if (options.digits) charset += CHAR_SETS.digits;
    if (options.special) charset += CHAR_SETS.special;

    if (charset.length === 0) charset = CHAR_SETS.lowercase + CHAR_SETS.uppercase;

    const array = new Uint32Array(length);
    window.crypto.getRandomValues(array);

    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset[array[i] % charset.length];
    }
    return password;
}

function calculateEntropy(length: number, options: any) {
    let poolSize = 0;
    if (options.lowercase) poolSize += 26;
    if (options.uppercase) poolSize += 26;
    if (options.digits) poolSize += 10;
    if (options.special) poolSize += 26;
    if (poolSize === 0) poolSize = 52;
    return Math.floor(length * Math.log2(poolSize));
}

function getStrengthInfo(entropy: number) {
    if (entropy < 40) return { label: 'Weak', color: 'bg-[#f85149]', textColor: 'text-[#f85149]', percent: 20 };
    if (entropy < 60) return { label: 'Fair', color: 'bg-[#d29922]', textColor: 'text-[#d29922]', percent: 40 };
    if (entropy < 80) return { label: 'Good', color: 'bg-[#58a6ff]', textColor: 'text-[#58a6ff]', percent: 60 };
    if (entropy < 100) return { label: 'Strong', color: 'bg-[#2ea043]', textColor: 'text-[#2ea043]', percent: 80 };
    return { label: 'Excellent', color: 'bg-[#00d68f]', textColor: 'text-[#00d68f]', percent: 100 };
}

export default function PasswordGenerator({ onUsePassword, onClose }: any) {
    const [length, setLength] = useState(20);
    const [options, setOptions] = useState<any>({
        lowercase: true, uppercase: true, digits: true, special: true,
    });
    const [generated, setGenerated] = useState('');
    const [copied, setCopied] = useState(false);
    const [animating, setAnimating] = useState(false);

    const doGenerate = useCallback(() => {
        setAnimating(true);
        const pw = generatePassword(length, options);
        setGenerated(pw);
        setCopied(false);
        setTimeout(() => setAnimating(false), 300);
    }, [length, options]);

    useEffect(() => {
        doGenerate();
    }, [doGenerate]);

    const entropy = calculateEntropy(length, options);
    const strength = getStrengthInfo(entropy);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(generated);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* ignore */ }
    };

    const toggleOption = (key: string) => {
        const newOpts = { ...options, [key]: !options[key] };
        if (!newOpts.lowercase && !newOpts.uppercase && !newOpts.digits && !newOpts.special) return;
        setOptions(newOpts);
    };

    return (
        <div className="bg-[#161b22]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl animate-fade-in relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] rounded-full pointer-events-none" />
            
            <div className="flex justify-between items-center mb-6 relative z-10">
                <h3 className="text-white text-lg font-bold flex items-center gap-2">
                    <span className="text-xl">🔑</span> Password Generator
                </h3>
                <button onClick={onClose} className="text-[#8b949e] hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
                    <X size={20} />
                </button>
            </div>

            <div className={`bg-[#0d1117] border border-white/10 rounded-xl p-4 font-mono text-lg tracking-wider text-[#e6edf3] break-all leading-relaxed mb-5 transition-opacity duration-300 ${animating ? 'opacity-50' : 'opacity-100'} shadow-inner`}>
                {generated}
            </div>

            <div className="mb-6">
                <div className="flex justify-between items-end mb-2">
                    <span className="text-sm text-[#8b949e]">
                        Strength: <strong className={strength.textColor}>{strength.label}</strong>
                    </span>
                    <span className="text-xs text-[#8b949e] font-mono">{entropy} bits</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div 
                        className={`h-full rounded-full transition-all duration-500 ease-out ${strength.color}`} 
                        style={{ width: `${strength.percent}%` }} 
                    />
                </div>
            </div>

            <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                    <label className="text-sm text-[#8b949e] font-medium">Length</label>
                    <span className="text-sm font-bold text-white bg-primary/20 text-primary px-3 py-1 rounded-full border border-primary/30">
                        {length}
                    </span>
                </div>
                <input
                    type="range" min="8" max="64" value={length}
                    onChange={e => setLength(Number(e.target.value))}
                    className="w-full accent-primary h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-[#8b949e] mt-2 font-mono">
                    <span>8</span><span>64</span>
                </div>
            </div>

            <div className="flex flex-wrap gap-2.5 mb-7">
                {Object.entries({ lowercase: 'a-z', uppercase: 'A-Z', digits: '0-9', special: '!@#' }).map(([key, label]) => (
                    <button
                        key={key}
                        onClick={() => toggleOption(key)}
                        className={`px-4 py-2 rounded-lg font-mono text-sm font-medium transition-all ${
                            options[key] 
                                ? 'bg-primary/20 border-primary/50 text-primary border shadow-[0_0_10px_rgba(88,166,255,0.15)]' 
                                : 'bg-transparent border-white/10 text-[#8b949e] border hover:bg-white/5 hover:text-[#c9d1d9]'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <div className="flex gap-3">
                <button 
                    onClick={doGenerate} 
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors font-medium text-sm border border-white/10"
                >
                    <RefreshCw size={16} className={animating ? 'animate-spin' : ''} />
                    Regenerate
                </button>
                <button 
                    onClick={handleCopy} 
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-colors font-medium text-sm border ${
                        copied 
                            ? 'bg-success/20 text-success border-success/30' 
                            : 'bg-white/5 hover:bg-white/10 text-white border-white/10'
                    }`}
                >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Copied!' : 'Copy'}
                </button>
                {onUsePassword && (
                    <button 
                        onClick={() => onUsePassword(generated)} 
                        className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-success/20 hover:bg-success/30 text-success rounded-xl transition-all font-medium text-sm border border-success/40 shadow-[0_0_15px_rgba(46,160,67,0.15)]"
                    >
                        <Check size={16} />
                        Use This
                    </button>
                )}
            </div>
        </div>
    );
}
