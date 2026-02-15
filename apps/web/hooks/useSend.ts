'use client';

import { useWallets, usePrivy } from '@privy-io/react-auth';
import { useState } from 'react';
import { tempoActions } from 'tempo.ts/viem';
import {
    createWalletClient,
    createPublicClient,
    custom,
    defineChain,
    http,
    parseUnits,
    stringToHex,
    walletActions,
    type Address,
} from 'viem';
import { TOKENS } from '@/lib/constants';

// Define Tempo Moderato chain for tempo.ts
const tempoModerato = defineChain({
    id: 42431,
    name: 'Tempo Moderato',
    nativeCurrency: { name: 'AlphaUSD', symbol: 'aUSD', decimals: 6 },
    rpcUrls: {
        default: { http: ['https://rpc.moderato.tempo.xyz'] },
    },
    feeToken: TOKENS[1].address as Address, // AlphaUSD as fee token (standard for testnet)
});

export function useSend() {
    const { wallets } = useWallets();
    const { user } = usePrivy();
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);

    const send = async (
        to: string,
        amount: string,
        tokenAddress: string,
        tokenDecimals: number,
        memo?: string
    ) => {
        if (isSending) return;
        setIsSending(true);
        setError(null);
        setTxHash(null);

        // Find the active wallet (prioritize user's primary wallet, or fallback to first available)
        const activeWallet = user?.wallet
            ? wallets.find(w => w.address.toLowerCase() === user.wallet?.address.toLowerCase())
            : wallets[0];

        if (!activeWallet) {
            const errMsg = 'No connected wallet found. Please log in.';
            setError(errMsg);
            setIsSending(false);
            throw new Error(errMsg);
        }

        try {
            // Switch network if needed
            await activeWallet.switchChain(tempoModerato.id);

            // Create Tempo client with the wallet provider
            const provider = await activeWallet.getEthereumProvider();

            // Create wallet client with tempo extensions
            const client = createWalletClient({
                account: activeWallet.address as Address,
                chain: tempoModerato,
                transport: custom(provider),
            })
                .extend(walletActions)
                .extend(tempoActions());

            // Execute TIP-20 transfer
            const parsedAmount = parseUnits(amount, tokenDecimals);
            const hash = await client.token.transfer({
                to: to as Address,
                amount: parsedAmount,
                memo: stringToHex(memo || 'Red Pocket Gift 🧧'),
                token: tokenAddress as Address,
            });

            setTxHash(hash);
            return { transactionHash: hash };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Transfer failed';
            setError(errorMessage);
            throw err;
        } finally {
            setIsSending(false);
        }
    };

    const activeWallet = user?.wallet
        ? wallets.find(w => w.address.toLowerCase() === user.wallet?.address.toLowerCase())
        : wallets[0];

    return {
        send,
        isSending,
        error,
        txHash,
        walletAddress: activeWallet?.address || null,
        reset: () => {
            setError(null);
            setTxHash(null);
        },
    };
}
