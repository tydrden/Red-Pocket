
'use client';

import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/header';
import { ProfileSection } from '@/components/profile-section';
import { SegmentedControl } from '@/components/ui/segmented-control';
import Link from 'next/link';
import { Plus, ExternalLink, Send, Loader2 } from 'lucide-react';
import { TOKENS } from '@/lib/constants';
import { createPublicClient, http, parseAbiItem, formatUnits, type Address, hexToString } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';

// Public client for reading Tempo blockchain
const tempoPublicClient = createPublicClient({
    chain: {
        id: 42431,
        name: 'Tempo Moderato',
        nativeCurrency: { name: 'USD', symbol: 'USD', decimals: 18 },
        rpcUrls: { default: { http: ['https://rpc.moderato.tempo.xyz'] } },
    },
    transport: http('https://rpc.moderato.tempo.xyz'),
});

// Standard ERC-20/TIP-20 Transfer event
const transferEvent = parseAbiItem(
    'event Transfer(address indexed from, address indexed to, uint256 value)'
);

// Confetti colors
const CONFETTI_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316'];

// Confetti particle component
function ConfettiParticle({ delay, color, left }: { delay: number; color: string; left: number }) {
    return (
        <motion.div
            initial={{ y: -20, x: 0, opacity: 1, rotate: 0, scale: 1 }}
            animate={{
                y: [0, 200, 400],
                x: [0, (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 150],
                opacity: [1, 1, 0],
                rotate: [0, 180, 360 + Math.random() * 360],
                scale: [1, 0.8, 0.3],
            }}
            transition={{
                duration: 3 + Math.random() * 2,
                delay: delay,
                ease: 'easeOut',
                repeat: Infinity,
                repeatDelay: 2,
            }}
            className="absolute pointer-events-none z-50"
            style={{ left: `${left}%`, top: -10 }}
        >
            <div
                className="rounded-sm"
                style={{
                    width: 6 + Math.random() * 6,
                    height: 6 + Math.random() * 6,
                    backgroundColor: color,
                }}
            />
        </motion.div>
    );
}

// Envelope card for received tokens
function EnvelopeCard({ tx, index }: { tx: any; index: number }) {
    const [isOpened, setIsOpened] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: index * 0.1, type: 'spring', stiffness: 200 }}
            onClick={() => setIsOpened(!isOpened)}
            className="cursor-pointer group"
        >
            <div className="relative overflow-hidden rounded-2xl border border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
                {/* Envelope flap (top triangle) */}
                <div className="relative">
                    <div
                        className="absolute inset-x-0 top-0 h-16 z-10"
                        style={{
                            background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #dc2626 100%)',
                            clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
                            opacity: isOpened ? 0 : 1,
                            transition: 'opacity 0.3s ease',
                        }}
                    />
                </div>

                {/* Envelope body */}
                <div
                    className="relative pt-4 pb-5 px-5"
                    style={{
                        background: 'linear-gradient(180deg, #fecaca 0%, #fee2e2 30%, var(--card) 60%)',
                    }}
                >
                    {/* Gold seal */}
                    <div className="absolute top-2 right-4 z-20">
                        <motion.div
                            animate={{ rotate: isOpened ? 45 : 0 }}
                            className="w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-lg"
                            style={{
                                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                            }}
                        >
                            🧧
                        </motion.div>
                    </div>

                    {/* Content */}
                    <div className="pt-6">
                        {/* Amount - large and prominent */}
                        <motion.div
                            animate={{ scale: isOpened ? [1, 1.1, 1] : 1 }}
                            transition={{ duration: 0.4 }}
                            className="mb-3"
                        >
                            <p className="text-3xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                                +{parseFloat(tx.amount).toFixed(2)}
                            </p>
                            <p className="text-sm font-semibold text-red-400">
                                {tx.token}
                            </p>
                        </motion.div>

                        {/* From address */}
                        <AnimatePresence>
                            {isOpened && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="pt-2 pb-1 space-y-2 border-t border-red-200/30">
                                        {tx.from && (
                                            <p className="text-xs font-mono text-muted-foreground">
                                                From: {tx.from.slice(0, 12)}...{tx.from.slice(-6)}
                                            </p>
                                        )}

                                        {tx.memo && (
                                            <p className="text-xs text-muted-foreground italic">
                                                "{tx.memo}"
                                            </p>
                                        )}

                                        {tx.txHash && (
                                            <a
                                                href={`https://explore.tempo.xyz/tx/${tx.txHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 text-xs text-primary hover:underline"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <ExternalLink className="w-3 h-3" /> View on Explorer
                                            </a>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Tap hint */}
                        {!isOpened && (
                            <p className="text-[10px] text-red-300/60 mt-2 text-center animate-pulse">
                                Tap to open envelope
                            </p>
                        )}
                    </div>
                </div>

                {/* Bottom envelope edge */}
                <div
                    className="h-1"
                    style={{ background: 'linear-gradient(90deg, #dc2626, #ef4444, #dc2626)' }}
                />
            </div>
        </motion.div>
    );
}


export default function Dashboard() {
    const { authenticated, user } = usePrivy();
    const { wallets } = useWallets();
    // Use the primary wallet address from the user object, or fallback to the first connected wallet
    const walletAddress = user?.wallet?.address || wallets[0]?.address;

    const [filter, setFilter] = useState('sent');
    const [sentGifts, setSentGifts] = useState<any[]>([]);
    const [receivedTransfers, setReceivedTransfers] = useState<any[]>([]);
    const [isLoadingReceived, setIsLoadingReceived] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch sent gifts from LocalStorage
    useEffect(() => {
        if (mounted) {
            const savedPockets = JSON.parse(localStorage.getItem('my_pockets') || '[]');
            setSentGifts(savedPockets);
        }
    }, [mounted]);

    // Show confetti when switching to received and there are items
    useEffect(() => {
        if (filter === 'received' && receivedTransfers.length > 0) {
            setShowConfetti(true);
            const timer = setTimeout(() => setShowConfetti(false), 6000);
            return () => clearTimeout(timer);
        }
    }, [filter, receivedTransfers.length]);

    // Fetch received transfers from blockchain (TIP-20 Transfer events)
    useEffect(() => {
        async function fetchReceivedTransfers() {
            if (!walletAddress) return;
            setIsLoadingReceived(true);
            console.log('Fetching transfers for:', walletAddress);

            try {
                // Get current block number to calculate ranges
                const currentBlock = await tempoPublicClient.getBlockNumber();
                const MAX_BLOCK_RANGE = 50000n;
                // Scan last 100k blocks (approx 1 day) for speed. 
                // If user needs more history, we can add a "Load More" button later.
                const SCAN_DEPTH = 100000n;
                const genesisBlock = 0n;
                let fromBlock = currentBlock - SCAN_DEPTH;
                if (fromBlock < genesisBlock) fromBlock = genesisBlock;

                console.log(`Scanning from block ${fromBlock} to ${currentBlock}`);

                // Process all tokens in parallel
                const results = await Promise.all(TOKENS.map(async (tokenInfo) => {
                    try {
                        const tokenTransfers: any[] = [];
                        const chunkPromises = [];

                        // Prepare all chunk requests
                        for (let start = fromBlock; start <= currentBlock; start += MAX_BLOCK_RANGE) {
                            const end = start + MAX_BLOCK_RANGE > currentBlock ? currentBlock : start + MAX_BLOCK_RANGE;

                            chunkPromises.push(
                                tempoPublicClient.getLogs({
                                    address: tokenInfo.address as Address,
                                    event: transferEvent,
                                    args: { to: walletAddress as Address },
                                    fromBlock: start,
                                    toBlock: end,
                                }).then(logs => ({ type: 'transfer', logs })),

                                tempoPublicClient.getLogs({
                                    address: tokenInfo.address as Address,
                                    event: parseAbiItem(
                                        'event TransferWithMemo(address indexed from, address indexed to, uint256 value, bytes32 indexed memo)'
                                    ),
                                    args: { to: walletAddress as Address },
                                    fromBlock: start,
                                    toBlock: end,
                                }).then(logs => ({ type: 'memo', logs }))
                            );
                        }

                        // Execute all chunks for this token in parallel
                        const chunkResults = await Promise.all(chunkPromises);

                        // Process results
                        for (const result of chunkResults) {
                            if (result.type === 'transfer') {
                                for (const log of result.logs) {
                                    const { from, value } = log.args as any;
                                    tokenTransfers.push({
                                        from,
                                        amount: formatUnits(value || 0n, tokenInfo.decimals),
                                        token: tokenInfo.symbol,
                                        tokenAddress: tokenInfo.address,
                                        txHash: log.transactionHash,
                                        blockNumber: Number(log.blockNumber),
                                        memo: null,
                                    });
                                }
                            } else {
                                for (const log of result.logs) {
                                    const { from, value, memo } = log.args as any;
                                    let decodedMemo = null;
                                    if (memo) {
                                        try {
                                            decodedMemo = hexToString(memo).replace(/\0/g, '');
                                        } catch (e) {
                                            decodedMemo = memo;
                                        }
                                    }

                                    tokenTransfers.push({
                                        from,
                                        amount: formatUnits(value || 0n, tokenInfo.decimals),
                                        token: tokenInfo.symbol,
                                        tokenAddress: tokenInfo.address,
                                        txHash: log.transactionHash,
                                        blockNumber: Number(log.blockNumber),
                                        memo: decodedMemo,
                                    });
                                }
                            }
                        }
                        return tokenTransfers;
                    } catch (e) {
                        console.warn(`Failed to fetch logs for ${tokenInfo.symbol}:`, e);
                        return [];
                    }
                }));

                const allTransfers = results.flat();

                // Sort by block number descending (newest first)
                allTransfers.sort((a, b) => b.blockNumber - a.blockNumber);
                setReceivedTransfers(allTransfers);
            } catch (e) {
                console.error('Error fetching received transfers:', e);
            } finally {
                setIsLoadingReceived(false);
            }
        }

        if (filter === 'received' && walletAddress) {
            fetchReceivedTransfers();
        }
    }, [filter, walletAddress]);

    const displayItems = filter === 'sent' ? sentGifts : receivedTransfers;

    return (
        <main className="min-h-screen p-4 pb-20 max-w-lg mx-auto relative overflow-hidden">
            {/* Confetti layer */}
            {showConfetti && (
                <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
                    {Array.from({ length: 30 }).map((_, i) => (
                        <ConfettiParticle
                            key={i}
                            delay={Math.random() * 1.5}
                            color={CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]}
                            left={Math.random() * 100}
                        />
                    ))}
                </div>
            )}

            <Header />

            <div className="space-y-6">
                <ProfileSection />

                <div className="flex items-center justify-between pt-4">
                    <h1 className="text-xl font-bold">My Pockets</h1>
                    <Link href="/create">
                        <Button size="icon" className="rounded-full h-10 w-10 shadow-lg shadow-primary/20">
                            <Plus className="w-5 h-5" />
                        </Button>
                    </Link>
                </div>
            </div>

            {!mounted ? (
                <div className="text-center py-20 text-muted-foreground">
                    Loading...
                </div>
            ) : !authenticated ? (
                <div className="text-center py-20 text-muted-foreground">
                    Connect wallet to view your gifts.
                </div>
            ) : (
                <div className="space-y-6">
                    <SegmentedControl
                        options={[
                            { label: '📤 Sent', value: 'sent' },
                            { label: '🧧 Received', value: 'received' },
                        ]}
                        value={filter}
                        onChange={setFilter}
                    />

                    <div className="space-y-3">
                        {/* Loading state for received */}
                        {isLoadingReceived && filter === 'received' && (
                            <div className="text-center py-10 flex flex-col items-center gap-3">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                >
                                    <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-2xl">
                                        🧧
                                    </div>
                                </motion.div>
                                <p className="text-sm text-muted-foreground">Opening your envelopes...</p>
                            </div>
                        )}

                        {/* Sent items */}
                        {filter === 'sent' && sentGifts.map((gift, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="bg-card p-4 rounded-2xl border border-border/50 shadow-sm hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                                            <Send className="w-4 h-4 text-orange-500" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">{gift.amount} {gift.token}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Sent</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {gift.createdAt ? new Date(gift.createdAt).toLocaleDateString() : ''}
                                    </p>
                                </div>

                                {gift.recipient && (
                                    <p className="text-xs font-mono text-muted-foreground truncate mb-2">
                                        To: {gift.recipient.slice(0, 10)}...{gift.recipient.slice(-6)}
                                    </p>
                                )}

                                {gift.message && (
                                    <p className="text-xs text-muted-foreground italic mb-2">&quot;{gift.message}&quot;</p>
                                )}

                                {gift.txHash && (
                                    <a
                                        href={`https://explore.tempo.xyz/tx/${gift.txHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                                    >
                                        <ExternalLink className="w-3 h-3" /> View on Explorer
                                    </a>
                                )}
                            </motion.div>
                        ))}

                        {/* Received items — Envelope design */}
                        {filter === 'received' && !isLoadingReceived && receivedTransfers.map((tx, i) => (
                            <EnvelopeCard key={i} tx={tx} index={i} />
                        ))}

                        {/* Empty states */}
                        {filter === 'sent' && sentGifts.length === 0 && (
                            <div className="text-center py-10">
                                <p className="text-4xl mb-3">📤</p>
                                <p className="text-muted-foreground">No sent pockets yet.</p>
                                <Link href="/create">
                                    <Button variant="link" className="mt-2 text-primary">Send your first gift</Button>
                                </Link>
                            </div>
                        )}

                        {filter === 'received' && !isLoadingReceived && receivedTransfers.length === 0 && (
                            <div className="text-center py-10">
                                <p className="text-4xl mb-3">🧧</p>
                                <p className="text-muted-foreground">No received gifts yet.</p>
                                <p className="text-xs text-muted-foreground mt-1">When someone sends you tokens, they&apos;ll appear here as red envelopes!</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </main>
    );
}
