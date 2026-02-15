
'use client';

'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/header';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Chip } from '@/components/ui/chip';
import { TOKENS, RED_PACKET_ADDRESS } from '@/lib/constants';
import { useSend } from '@/hooks/useSend';
import RedPacketABI from '@/lib/abi/RedPacket.json';
import { hexToBase64 } from '@/lib/utils';

import { Loader2, Gift, CheckCircle, Settings2, Copy, Share2, HelpCircle, ExternalLink, Shuffle, Users } from 'lucide-react';
import { isAddress, type Address, encodeFunctionData, parseUnits, createPublicClient, http, createWalletClient, custom } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

// ERC20 ABI for Approve
const ERC20_ABI = [
    {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
        outputs: [{ name: '', type: 'bool' }]
    }
];

export default function CreatePage() {
    const { login, authenticated } = usePrivy();
    const { wallets } = useWallets();
    const { send, isSending, error: sendError, txHash, walletAddress, reset } = useSend();

    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    // Mode: 'single' | 'link'
    const [mode, setMode] = useState('single');

    // Form State
    const [token, setToken] = useState(TOKENS[0]);
    const [amount, setAmount] = useState('');
    const [recipient, setRecipient] = useState('');
    const [message, setMessage] = useState('');

    // Red Pocket State
    const [count, setCount] = useState('5');
    const [isRandom, setIsRandom] = useState(true);
    const [createdLink, setCreatedLink] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState('');

    // Constants
    const MESSAGES = ["Best Wishes! 🎁", "GM! ☀️", "Happy Birthday! 🎂", "Congrats! 🎉", "For Coffee ☕️"];

    async function handleCreate() {
        if (!authenticated) return;
        setCreateError('');

        if (mode === 'single') {
            handleDirectSend();
        } else {
            handleCreateLink();
        }
    }

    async function handleDirectSend() {
        try {
            if (!isAddress(recipient)) {
                alert('Please enter a valid address');
                return;
            }
            if (!amount || parseFloat(amount) <= 0) {
                alert('Please enter a valid amount');
                return;
            }

            await send(
                recipient,
                amount,
                token.address,
                token.decimals,
                message || 'Red Pocket Gift 🧧'
            );

            // LocalStorage saving is handled in useSend or here if needed, 
            // keeping consistent with previous logic
            const savedPockets = JSON.parse(localStorage.getItem('my_pockets') || '[]');
            const newPocket = {
                id: Date.now().toString(), // Temp ID until txHash is confirmed in hook
                amount: amount,
                token: token.symbol,
                recipient: recipient,
                status: 'sent',
                mode: 'single',
                message: message,
                createdAt: Date.now(),
                txHash: null, // Hook handles this
            };
            savedPockets.unshift(newPocket);
            localStorage.setItem('my_pockets', JSON.stringify(savedPockets));

        } catch (e) {
            console.error('Transfer error:', e);
        }
    }

    async function handleCreateLink() {
        const wallet = wallets.find((w) => w.address.toLowerCase() === walletAddress?.toLowerCase());
        if (!wallet) {
            console.error('Wallet not found for address:', walletAddress);
            return;
        }

        setIsCreating(true);
        try {
            // Ensure we are on the correct chain
            await wallet.switchChain(42431);

            const provider = await wallet.getEthereumProvider();
            const walletClient = createWalletClient({
                account: walletAddress as Address,
                chain: {
                    id: 42431,
                    name: 'Tempo Moderato',
                    nativeCurrency: { name: 'AlphaUSD', symbol: 'aUSD', decimals: 6 },
                    rpcUrls: { default: { http: ['https://rpc.moderato.tempo.xyz'] } },
                },
                transport: custom(provider),
            });
            const publicClient = createPublicClient({
                chain: {
                    id: 42431,
                    name: 'Tempo Moderato',
                    nativeCurrency: { name: 'AlphaUSD', symbol: 'aUSD', decimals: 6 },
                    rpcUrls: { default: { http: ['https://rpc.moderato.tempo.xyz'] } },
                },
                transport: http(),
            });

            // Fetch current gas fees
            // @ts-ignore
            const fees = await publicClient.estimateFeesPerGas();
            const gasPrice = fees.maxFeePerGas || undefined;
            const priorityFee = fees.maxPriorityFeePerGas || undefined;

            console.log("Fees:", fees);

            // 1. Generate Ephemeral Key
            const privateKey = generatePrivateKey();
            const account = privateKeyToAccount(privateKey);
            const signerPtr = account.address;

            // 2. Approve Token
            const amountBigInt = parseUnits(amount, token.decimals);

            // Check allowance first? (Skipping for brevity, just approve)
            const approveHash = await walletClient.writeContract({
                address: token.address as Address,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [RED_PACKET_ADDRESS, amountBigInt],
                account: walletAddress as Address,
                maxFeePerGas: gasPrice,
                maxPriorityFeePerGas: priorityFee,
            });
            console.log('Approve Hash:', approveHash);
            await publicClient.waitForTransactionReceipt({ hash: approveHash });

            // 3. Create Packet
            // Params: token, totalAmount, count, isRandom, signerPtr, restrictedTo(0), duration, message, answerHash(0)
            const duration = 24 * 60 * 60; // 24 hours
            const createHash = await walletClient.writeContract({
                address: RED_PACKET_ADDRESS as Address,
                abi: RedPacketABI,
                functionName: 'createPacket',
                args: [
                    token.address,
                    amountBigInt,
                    BigInt(count),
                    isRandom,
                    signerPtr,
                    '0x0000000000000000000000000000000000000000', // No restriction
                    BigInt(duration),
                    message || 'Red Pocket Gift 🧧',
                    '0x0000000000000000000000000000000000000000000000000000000000000000', // No question
                ],
                account: walletAddress as Address,
                maxFeePerGas: gasPrice,
                maxPriorityFeePerGas: priorityFee,
            });
            console.log('Create Packet Hash:', createHash);

            const receipt = await publicClient.waitForTransactionReceipt({ hash: createHash });

            // Extract PacketId from logs
            // Event PacketCreated(bytes32 indexed packetId, ...)
            // The first topic is event signature, second is packetId (indexed)
            const packetCreatedLog = receipt.logs.find(log => log.address.toLowerCase() === RED_PACKET_ADDRESS.toLowerCase());
            if (!packetCreatedLog) throw new Error('Packet creation event not found');

            const packetId = packetCreatedLog.topics[1];

            // 4. Generate Link
            // Encode packetId and privateKey to Base64 to make the link shorter
            const shortPacketId = hexToBase64(packetId);
            const shortPrivateKey = hexToBase64(privateKey);

            const link = `${window.location.origin}/claim/${shortPacketId}#${shortPrivateKey}`;
            setCreatedLink(link);

            // Save to local storage
            const savedPockets = JSON.parse(localStorage.getItem('my_pockets') || '[]');
            const newPocket = {
                id: packetId,
                amount: amount,
                token: token.symbol,
                recipient: 'Multiple',
                status: 'created',
                mode: 'link',
                message: message,
                createdAt: Date.now(),
                txHash: createHash,
                link: link
            };
            savedPockets.unshift(newPocket);
            localStorage.setItem('my_pockets', JSON.stringify(savedPockets));

        } catch (e: any) {
            console.error('Create Link Error:', e);
            setCreateError(e.message || 'Failed to create Red Pocket');
        } finally {
            setIsCreating(false);
        }
    }

    // Success screen for Link Mode
    if (createdLink) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-card w-full p-8 rounded-3xl border border-border/50 shadow-2xl relative overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-orange-500" />
                    <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Gift className="w-8 h-8 text-green-500" />
                    </div>

                    <h2 className="text-2xl font-bold mb-2">Red Pocket Ready!</h2>
                    <p className="text-muted-foreground mb-6">
                        Share this link with your friends to claim.
                    </p>

                    <div className="bg-secondary/50 p-4 rounded-xl flex items-center gap-3 mb-6 border border-dashed border-border">
                        <div className="bg-white p-2 rounded-lg">
                            <Share2 className="w-5 h-5 text-black" />
                        </div>
                        <div className="text-left flex-1 overflow-hidden">
                            <p className="text-xs text-muted-foreground truncate">
                                {createdLink.split('#')[0]}<span className="text-muted-foreground/50">#SECRET_KEY_HIDDEN</span>
                            </p>
                        </div>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigator.clipboard.writeText(createdLink)}
                        >
                            <Copy className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-6 text-sm text-left">
                        <div className="bg-secondary/30 p-3 rounded-xl">
                            <p className="text-muted-foreground text-xs">Total Amount</p>
                            <p className="font-bold">{amount} {token.symbol}</p>
                        </div>
                        <div className="bg-secondary/30 p-3 rounded-xl">
                            <p className="text-muted-foreground text-xs">Claims</p>
                            <p className="font-bold">{count} People</p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button
                            className="flex-1" variant="outline"
                            onClick={() => navigator.share?.({ title: 'Red Pocket', url: createdLink }).catch(() => { })}
                        >
                            Share System
                        </Button>
                        <Button
                            className="flex-1"
                            variant="premium"
                            onClick={() => {
                                setCreatedLink('');
                                setAmount('');
                                setMessage('');
                                setMode('single'); // Reset to default
                            }}
                        >
                            Create New
                        </Button>
                    </div>
                </motion.div>
            </div>
        );
    }

    // Success screen for Direct Mode (using existing txHash logic from hook)
    if (txHash && mode === 'single') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-card w-full p-8 rounded-3xl border border-border/50 shadow-2xl relative overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-orange-500" />
                    <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>

                    <h2 className="text-2xl font-bold mb-2">Sent Successfully!</h2>
                    <p className="text-muted-foreground mb-6">
                        {amount} {token.symbol} has been sent 🎉
                    </p>

                    <div className="bg-secondary/50 p-3 rounded-xl break-all text-xs font-mono text-left mb-4">
                        <p className="text-muted-foreground text-[10px] uppercase font-bold mb-1">Transaction Hash</p>
                        {txHash}
                    </div>

                    <a
                        href={`https://explore.tempo.xyz/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <Button variant="outline" className="w-full mb-3">
                            <ExternalLink className="mr-2 w-4 h-4" /> View on Explorer
                        </Button>
                    </a>

                    <Button
                        variant="premium"
                        className="w-full"
                        onClick={() => {
                            reset();
                            setAmount('');
                            setRecipient('');
                            setMessage('');
                        }}
                    >
                        Send Another
                    </Button>
                </motion.div>
            </div>
        )
    }

    if (!mounted) return (
        <main className="min-h-screen pb-20 p-4 max-w-lg mx-auto flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </main>
    )

    return (
        <main className="min-h-screen pb-20 p-4 max-w-lg mx-auto">
            <Header />
            <div className="mb-6 pt-2">
                <SegmentedControl
                    options={[
                        { label: 'Send Direct', value: 'single' },
                        { label: 'Share Link', value: 'link' },
                    ]}
                    value={mode}
                    onChange={setMode}
                />
            </div>

            {!authenticated ? (
                <div className="text-center py-20 space-y-4">
                    <p className="text-muted-foreground">Connect wallet to send gifts.</p>
                    <Button onClick={() => login()}>
                        Connect Wallet
                    </Button>
                </div>
            ) : (
                <div className="space-y-6">

                    {/* Token & Amount */}
                    <div className="bg-card p-6 rounded-3xl border border-border/50 shadow-lg space-y-6">
                        <div>
                            <label className="text-sm text-muted-foreground ml-1 mb-2 block">Token</label>
                            <div className="flex gap-2 overflow-x-auto pb-2 noscroll">
                                {TOKENS.map(t => (
                                    <Chip
                                        key={t.symbol}
                                        active={token.symbol === t.symbol}
                                        onClick={() => setToken(t)}
                                    >
                                        {t.symbol}
                                    </Chip>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-sm text-muted-foreground ml-1 mb-2 block">Total Amount</label>
                            <div className="relative">
                                <Input
                                    className="text-4xl font-bold h-20 pl-4 pr-16 rounded-2xl bg-secondary/30 border-transparent focus:border-primary/50"
                                    placeholder="0.0"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    type="number"
                                />
                                <div className="absolute right-6 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">
                                    {token.symbol}
                                </div>
                            </div>
                        </div>

                        {mode === 'single' ? (
                            <div>
                                <label className="text-sm text-muted-foreground ml-1 mb-2 block">Recipient Address</label>
                                <Input
                                    placeholder="0x..."
                                    value={recipient}
                                    onChange={e => setRecipient(e.target.value)}
                                    className="font-mono"
                                />
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-muted-foreground ml-1 mb-2 block">People</label>
                                    <div className="relative">
                                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            type="number"
                                            value={count}
                                            onChange={e => setCount(e.target.value)}
                                            className="pl-9"
                                            placeholder="5"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm text-muted-foreground ml-1 mb-2 block">Mode</label>
                                    <div className="flex bg-secondary/30 p-1 rounded-xl h-10">
                                        <button
                                            onClick={() => setIsRandom(true)}
                                            className={`flex-1 flex items-center justify-center gap-1 text-xs font-medium rounded-lg transition-all ${isRandom ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
                                        >
                                            <Shuffle className="w-3 h-3" /> Lucky
                                        </button>
                                        <button
                                            onClick={() => setIsRandom(false)}
                                            className={`flex-1 flex items-center justify-center gap-1 text-xs font-medium rounded-lg transition-all ${!isRandom ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
                                        >
                                            <Settings2 className="w-3 h-3" /> Equal
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Message */}
                    <div className="space-y-3">
                        <label className="text-sm text-muted-foreground ml-1">Message</label>
                        <div className="flex gap-2 overflow-x-auto pb-2 noscroll">
                            {MESSAGES.map(msg => (
                                <button
                                    key={msg}
                                    onClick={() => setMessage(msg)}
                                    className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium border transition-all ${message === msg ? 'bg-primary/10 border-primary text-primary' : 'bg-card border-border/50 hover:bg-secondary'}`}
                                >
                                    {msg}
                                </button>
                            ))}
                        </div>
                        <Input
                            placeholder="Write a message..."
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                        />
                    </div>

                    {/* Sender Wallet Info */}
                    {walletAddress && (
                        <div className="bg-secondary/30 p-3 rounded-xl text-xs text-muted-foreground">
                            <span className="font-semibold">Sending from: </span>
                            <span className="font-mono">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
                        </div>
                    )}

                    {/* Submit */}
                    <Button
                        className="w-full h-16 text-lg rounded-2xl shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all font-bold"
                        variant="premium"
                        onClick={handleCreate}
                        disabled={isSending || isCreating || !amount || (mode === 'single' && !isAddress(recipient))}
                    >
                        {isSending || isCreating ? (
                            <span className="flex items-center gap-2">
                                <Loader2 className="w-5 h-5 animate-spin" /> {isCreating ? 'Creating Pocket...' : 'Sending...'}
                            </span>
                        ) : (
                            mode === 'single' ? `Send ${amount || '0'} ${token.symbol}` : `Create Red Pocket`
                        )}
                    </Button>

                    {(sendError || createError) && (
                        <p className="text-center text-sm text-red-500 bg-red-500/10 p-3 rounded-xl">
                            {(sendError || createError).includes('User rejected') ? 'Transaction rejected' : (sendError || createError)}
                        </p>
                    )}
                </div>
            )}
        </main>
    );
}
