
'use client';

import { useState, useRef, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Gift, LogOut, Wallet, LayoutDashboard, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function Header() {
    const { isConnected, address } = useAccount();
    const { login, logout, authenticated } = usePrivy();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <header className="flex justify-between items-center py-6 px-4 max-w-lg mx-auto w-full z-50 relative">
            <Link href="/" className="flex items-center gap-2 group">
                <div className="w-8 h-8 bg-gradient-to-tr from-primary to-orange-500 rounded-lg flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-all">
                    <Gift className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-lg tracking-tight group-hover:text-primary transition-colors">Red Pocket</span>
            </Link>

            {!authenticated ? (
                <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-full px-4 font-semibold hover:bg-white/10"
                    onClick={() => login()}
                >
                    Connect
                </Button>
            ) : (
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="flex items-center gap-2 bg-secondary/50 rounded-full px-4 py-2 border border-white/5 hover:bg-secondary/80 transition-all"
                    >
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-sm font-mono text-muted-foreground">
                            {address?.slice(0, 6)}...{address?.slice(-4)}
                        </span>
                        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                        {isOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                transition={{ duration: 0.1 }}
                                className="absolute right-0 top-full mt-2 w-48 bg-card border border-border/50 rounded-xl shadow-xl overflow-hidden z-50 text-sm"
                            >
                                <div className="p-1">
                                    <Link href="/my-gifts" onClick={() => setIsOpen(false)}>
                                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer">
                                            <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
                                            <span>Dashboard</span>
                                        </div>
                                    </Link>
                                    <Link href="/create" onClick={() => setIsOpen(false)}>
                                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer">
                                            <Gift className="w-4 h-4 text-muted-foreground" />
                                            <span>Create Pocket</span>
                                        </div>
                                    </Link>
                                    <div className="h-px bg-border/50 my-1" />
                                    <button
                                        onClick={() => {
                                            logout();
                                            setIsOpen(false);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer text-left"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        <span>Disconnect</span>
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </header>
    );
}
