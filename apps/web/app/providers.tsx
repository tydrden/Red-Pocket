
'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config, tempoTestnet } from '../lib/config';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <PrivyProvider
            appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || "YOUR_PRIVY_APP_ID"}
            config={{
                appearance: {
                    theme: 'dark',
                    accentColor: '#ef4444',
                },
                defaultChain: tempoTestnet,
                supportedChains: [tempoTestnet],
                loginMethods: ['email', 'wallet', 'google', 'sms'],
            }}
        >
            <WagmiProvider config={config}>
                <QueryClientProvider client={queryClient}>
                    {children}
                </QueryClientProvider>
            </WagmiProvider>
        </PrivyProvider>
    );
}
