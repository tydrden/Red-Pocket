import { http } from 'wagmi';
import { defineChain } from 'viem';
import { createConfig } from '@privy-io/wagmi';

// Define Tempo Moderato Testnet chain
export const tempoTestnet = defineChain({
    id: 42431,
    name: 'Tempo Testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'USD',
        symbol: 'USD',
    },
    rpcUrls: {
        default: {
            http: ['https://rpc.moderato.tempo.xyz'],
            webSocket: ['wss://rpc.moderato.tempo.xyz'],
        },
    },
    blockExplorers: {
        default: {
            name: 'Tempo Explorer',
            url: 'https://explore.tempo.xyz',
        },
    },
    testnet: true,
});

export const config = createConfig({
    chains: [tempoTestnet],
    transports: {
        [tempoTestnet.id]: http('https://rpc.moderato.tempo.xyz'),
    },
});
