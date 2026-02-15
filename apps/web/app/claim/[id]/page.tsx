'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/header';
import { Loader2, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { createPublicClient, http, createWalletClient, custom, type Address, hexToBytes, keccak256, encodePacked, stringToHex, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import RedPacketABI from '@/lib/abi/RedPacket.json';
import { RED_PACKET_ADDRESS, TOKENS } from '@/lib/constants';
import { motion } from 'framer-motion';

import { base64ToHex } from '@/lib/utils';

export default function ClaimPage() {
    const params = useParams();
    // Decode packetId from Base64 if it's not hex
    const rawId = params.id as string;
    const packetId = rawId.startsWith('0x') ? rawId : base64ToHex(rawId);

    const { login, authenticated, user } = usePrivy();
    const { wallets } = useWallets();

    const [loading, setLoading] = useState(true);
    const [privateKey, setPrivateKey] = useState<string | null>(null);
    const [packetData, setPacketData] = useState<any>(null);
    const [claimStatus, setClaimStatus] = useState<'idle' | 'claiming' | 'success' | 'error' | 'confirming'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [txHash, setTxHash] = useState('');
    const [claimedAmount, setClaimedAmount] = useState('');

    useEffect(() => {
        // Extract private key from hash (window.location.hash)
        const hash = window.location.hash;
        if (hash && hash.length > 1) {
            const rawKey = hash.substring(1); // Remove '#'
            // Try to decode if needed
            try {
                const key = rawKey.startsWith('0x') ? rawKey : base64ToHex(rawKey);
                setPrivateKey(key);
            } catch (e) {
                console.error("Error decoding key", e);
                setPrivateKey(rawKey); // Fallback
            }

            // Remove the hash from the URL to hide the private key
            window.history.replaceState(null, '', window.location.pathname);
        }
    }, []);

    useEffect(() => {
        async function fetchPacketDetails() {
            try {
                const publicClient = createPublicClient({
                    chain: {
                        id: 42431,
                        name: 'Tempo Moderato',
                        nativeCurrency: { name: 'AlphaUSD', symbol: 'aUSD', decimals: 6 },
                        rpcUrls: { default: { http: ['https://rpc.moderato.tempo.xyz'] } },
                    },
                    transport: http(),
                });

                // Fetch packet data from contract
                // function packets(bytes32) view returns (...)
                const data: any = await publicClient.readContract({
                    address: RED_PACKET_ADDRESS as Address,
                    abi: RedPacketABI,
                    functionName: 'packets',
                    args: [packetId],
                });

                // Struct Packet: creator, token, balance, initialBalance, count, initialCount, isRandom, expiresAt...
                // The returned array order matches the struct
                setPacketData({
                    creator: data[0],
                    token: data[1],
                    balance: data[2],
                    initialBalance: data[3],
                    count: data[4],
                    initialCount: data[5],
                    isRandom: data[6],
                    expiresAt: data[7],
                    message: data[12]
                });

            } catch (e) {
                console.error("Error fetching packet:", e);
                setErrorMsg("Packet not found or invalid.");
            } finally {
                setLoading(false);
            }
        }

        if (packetId) {
            fetchPacketDetails();
        }
    }, [packetId]);

    const handleClaim = async () => {
        if (!authenticated || !privateKey || !packetData) return;

        // Find the active wallet matching user's login
        const wallet = user?.wallet
            ? wallets.find(w => w.address.toLowerCase() === user.wallet?.address.toLowerCase())
            : wallets[0];

        if (!wallet) {
            setErrorMsg("No wallet found. Please reconnect.");
            return;
        }

        setClaimStatus('claiming');
        setErrorMsg('');

        try {
            // Ensure we are on the correct chain
            await wallet.switchChain(42431);

            const provider = await wallet.getEthereumProvider();
            const walletClient = createWalletClient({
                account: wallet.address as Address,
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

            // 1. Reconstruct Signer from Ephemeral Private Key
            // Ensure privateKey starts with 0x and doesn't double prefix
            const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
            const signerAccount = privateKeyToAccount(formattedKey as `0x${string}`);

            // 2. Sign Message: keccak256(packetId, userAddress)
            // Smart Contract verifies: ECDSA.recover(hash, signature) == signerPtr

            // Note: library MessageHashUtils.toEthSignedMessageHash happens on contract? 
            // Contract code: 
            // bytes32 hash = keccak256(abi.encodePacked(_packetId, msg.sender));
            // bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(hash);
            // ECDSA.recover(ethSignedHash, _signature)

            // So we need to sign the *raw hash* using the ephemeral key. 
            // viem's signMessage automatically applies the specific prefix (\x19Ethereum Signed Message:\n32...), 
            // matching MessageHashUtils.toEthSignedMessageHash logic.

            const messageHash = keccak256(encodePacked(
                ['bytes32', 'address'],
                [packetId as `0x${string}`, wallet.address as Address]
            ));

            // We need to sign this hash. Since signMessage inputs string or raw bytes and adds prefix, 
            // we should pass the raw bytes of the hash.
            const signature = await signerAccount.signMessage({
                message: { raw: messageHash }
            });

            // 3. Call Claim
            const hash = await walletClient.writeContract({
                address: RED_PACKET_ADDRESS as Address,
                abi: RedPacketABI,
                functionName: 'claim',
                args: [
                    packetId,
                    signature,
                    '' // No answer required for now
                ],
                account: wallet.address as Address
            });
            console.log("Claim Tx:", hash);
            setTxHash(hash);

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            // Parse Claimed event to get amount
            const claimedLog = receipt.logs.find(log => log.address.toLowerCase() === RED_PACKET_ADDRESS.toLowerCase());
            // Event Claimed(bytes32 indexed packetId, address indexed claimer, uint256 amount)
            // amount is data (non-indexed)
            if (claimedLog) {
                // Decoding data if needed, but for now we can just check balance changes or similar. 
                // Or decoding the log data manually.
                const amountHex = claimedLog.data;
                const decimals = TOKENS.find(t => t.address.toLowerCase() === packetData.token.toLowerCase())?.decimals || 18;
                // Assuming standard encoding for uint256
                const amountVal = parseInt(amountHex.toString(), 16);
                // Adjust logic for proper big int parsing
                // Use formatUnits from viem
                // But wait, createPublicClient is easier to use decodeEventLog
            }

            setClaimStatus('success');

        } catch (e: any) {
            console.error("Claim Error:", e);
            setErrorMsg(e.message || "Claim failed.");
            setClaimStatus('error');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!packetData || !privateKey) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h1 className="text-xl font-bold">Invalid Red Pocket</h1>
                <p className="text-muted-foreground">The link is broken or the packet does not exist.</p>
            </div>
        )
    }

    // Determine Token Symbol
    const tokenInfo = TOKENS.find(t => t.address.toLowerCase() === packetData.token.toLowerCase()) || { symbol: 'Tokens', decimals: 18 };
    const isCollected = Number(packetData.count) === 0;

    return (
        <main className="min-h-screen pb-20 p-4 max-w-lg mx-auto flex flex-col items-center justify-center text-center">
            <div className="absolute top-0 w-full p-4">
                <Header />
            </div>

            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full bg-card rounded-3xl border border-border/50 shadow-2xl p-8 relative overflow-hidden"
            >
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-red-600 to-red-500 rounded-b-[50%]" />

                <div className="relative z-10 pt-12">
                    <div className="w-20 h-20 bg-yellow-400 rounded-full mx-auto border-4 border-card flex items-center justify-center text-3xl shadow-lg">
                        🧧
                    </div>
                </div>

                <div className="mt-6 space-y-2">
                    <p className="text-sm text-muted-foreground">You received a Red Pocket</p>
                    <h2 className="text-lg font-medium">{packetData.message || "Best Wishes!"}</h2>
                </div>

                <div className="mt-8">
                    {claimStatus === 'success' ? (
                        <div>
                            <p className="text-3xl font-bold text-green-500">Claimed!</p>
                            <p className="text-muted-foreground mt-2">Check your wallet.</p>
                            {txHash && (
                                <a href={`https://explore.tempo.xyz/tx/${txHash}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 text-xs text-primary mt-4 hover:underline">
                                    <ExternalLink className="w-3 h-3" /> View Transaction
                                </a>
                            )}
                        </div>
                    ) : isCollected ? (
                        <div>
                            <p className="text-2xl font-bold text-muted-foreground">Fully Claimed</p>
                            <p className="text-sm text-muted-foreground">Better luck next time!</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {!authenticated ? (
                                <Button size="lg" className="w-full rounded-xl" onClick={login}>
                                    Connect Wallet to Claim
                                </Button>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-secondary/30 p-4 rounded-xl">
                                        <p className="text-sm text-muted-foreground">Claiming as</p>
                                        <p className="font-mono text-xs">{user?.wallet?.address}</p>
                                    </div>
                                    <Button
                                        size="lg"
                                        className="w-full rounded-xl h-14 text-lg font-bold bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white shadow-lg shadow-red-500/20"
                                        onClick={() => setClaimStatus('confirming')}
                                        disabled={claimStatus === 'claiming'}
                                    >
                                        Open Red Pocket
                                    </Button>

                                    {/* Confirmation Modal/Overlay would go here, but for simplicity swapping button state or using a simple confirm for now. 
                                        Retrying with a simpler approach: */}
                                    {claimStatus === 'confirming' && (
                                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                                            <div className="bg-card p-6 rounded-2xl w-full max-w-sm border border-border shadow-2xl animate-in zoom-in-95">
                                                <h3 className="text-lg font-bold mb-2">Confirm Claim</h3>
                                                <p className="text-sm text-muted-foreground mb-4">
                                                    You are about to claim this gift to your wallet:
                                                    <br />
                                                    <span className="font-mono text-xs bg-secondary px-1 rounded text-foreground">{user?.wallet?.address}</span>
                                                </p>
                                                <div className="flex gap-3">
                                                    <Button variant="outline" className="flex-1" onClick={() => setClaimStatus('idle')}>
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        variant="premium"
                                                        className="flex-1"
                                                        onClick={() => {
                                                            setClaimStatus('claiming'); // Move to claiming state
                                                            handleClaim();
                                                        }}
                                                    >
                                                        Confirm
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {errorMsg && (
                    <p className="mt-4 text-sm text-red-500 bg-red-500/10 p-2 rounded-lg">{errorMsg}</p>
                )}

            </motion.div>
        </main>
    );
}
