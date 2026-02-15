
'use client';

import { usePrivy } from '@privy-io/react-auth';
import { motion } from 'framer-motion';
import {
    Copy,
    CheckCircle,
    Wallet,
    Mail,
    Smartphone,
    Twitter,
    Github,
    Linkedin,
    Globe,
    MessageCircle,
    Command,
    Video,
    Key
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export function ProfileSection() {
    const { user } = usePrivy();
    const [copied, setCopied] = useState(false);

    if (!user) return null;

    // Get wallet address from Privy user object (embedded or linked wallet)
    const walletAccount = user.linkedAccounts.find((a: any) => a.type === 'wallet');
    const walletAddress = (walletAccount as any)?.address || user.wallet?.address || null;

    const copyAddress = () => {
        if (walletAddress) {
            navigator.clipboard.writeText(walletAddress);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const getAccountDisplay = (account: any) => {
        switch (account.type) {
            case 'email':
                return { icon: Mail, label: 'Email', value: account.address, color: 'text-blue-400', bg: 'bg-blue-400/10' };
            case 'phone':
                return { icon: Smartphone, label: 'Phone', value: account.number, color: 'text-green-400', bg: 'bg-green-400/10' };
            case 'wallet':
                return { icon: Wallet, label: 'Wallet', value: account.address?.slice(0, 6) + '...' + account.address?.slice(-4), color: 'text-orange-400', bg: 'bg-orange-400/10' };
            case 'google_oauth':
                return { icon: Globe, label: 'Google', value: account.email || 'Linked', color: 'text-red-400', bg: 'bg-red-400/10' };
            case 'twitter_oauth':
                return { icon: Twitter, label: 'Twitter', value: account.username ? `@${account.username}` : 'Linked', color: 'text-sky-400', bg: 'bg-sky-400/10' };
            case 'discord_oauth':
                return { icon: MessageCircle, label: 'Discord', value: account.username || 'Linked', color: 'text-indigo-400', bg: 'bg-indigo-400/10' };
            case 'github_oauth':
                return { icon: Github, label: 'GitHub', value: account.username || 'Linked', color: 'text-white', bg: 'bg-white/10' };
            case 'linkedin_oauth':
                return { icon: Linkedin, label: 'LinkedIn', value: account.name || 'Linked', color: 'text-blue-600', bg: 'bg-blue-600/10' };
            case 'apple_oauth':
                return { icon: Command, label: 'Apple', value: account.email || 'Linked', color: 'text-gray-400', bg: 'bg-gray-400/10' };
            case 'tiktok_oauth':
                return { icon: Video, label: 'TikTok', value: account.username || 'Linked', color: 'text-pink-400', bg: 'bg-pink-400/10' };
            case 'farcaster':
                return { icon: Globe, label: 'Farcaster', value: account.username || `fid:${account.fid}`, color: 'text-purple-400', bg: 'bg-purple-400/10' };
            case 'passkey':
                return { icon: Key, label: 'Passkey', value: 'Active', color: 'text-yellow-400', bg: 'bg-yellow-400/10' };
            default:
                return { icon: Globe, label: account.type, value: 'Linked', color: 'text-gray-400', bg: 'bg-gray-400/10' };
        }
    };

    return (
        <section className="mb-8 space-y-6">
            {/* Main Wallet Card */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-card to-card/50 p-6 rounded-3xl border border-border/50 shadow-lg relative overflow-hidden group"
            >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Wallet className="w-24 h-24 text-primary" />
                </div>

                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Connected Wallet</h2>
                <div className="flex items-center gap-3">
                    <div className="font-mono text-2xl md:text-3xl font-bold truncate tracking-tight text-foreground">
                        {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Generating...'}
                    </div>
                    {walletAddress && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={copyAddress}
                            className="rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                            {copied ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                        </Button>
                    )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs text-green-400 font-medium">Tempo Testnet Active</span>
                </div>
            </motion.div>

            {/* Linked Accounts Grid */}
            <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">Linked Identity</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {user.linkedAccounts.filter((a: any) => a.type !== 'wallet').map((account: any, i: number) => {
                        const { icon: Icon, label, value, color, bg } = getAccountDisplay(account);
                        return (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.05 }}
                                className={`${bg} border border-white/5 p-3 rounded-2xl flex items-center gap-3 overflow-hidden`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-background/50 ${color}`}>
                                    <Icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground leading-tight">{label}</p>
                                    <p className="text-xs font-medium truncate text-foreground">{value}</p>
                                </div>
                            </motion.div>
                        );
                    })}

                    {user.linkedAccounts.filter((a: any) => a.type !== 'wallet').length === 0 && (
                        <div className="col-span-full py-8 text-center text-muted-foreground text-sm bg-card/30 rounded-2xl border border-dashed border-border/50">
                            No social accounts linked.
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
