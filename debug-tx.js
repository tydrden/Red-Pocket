const { createPublicClient, http, parseAbiItem } = require('viem');
const { tempo } = require('viem/chains');

const client = createPublicClient({
    chain: {
        id: 42431,
        name: 'Tempo Moderato',
        nativeCurrency: { name: 'USD', symbol: 'USD', decimals: 18 },
        rpcUrls: { default: { http: ['https://rpc.moderato.tempo.xyz'] } },
    },
    transport: http('https://rpc.moderato.tempo.xyz'),
});

async function checkLogs() {
    const recipient = '0xaE459f19085Ea9D9886117365E3D34a6faD6Fac8';
    const tokenAddress = '0x20c0000000000000000000000000000000000000'; // PathUSD

    console.log('Checking getLogs for recipient:', recipient);

    try {
        const logs = await client.getLogs({
            address: tokenAddress,
            event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
            args: {
                to: recipient
            },
            fromBlock: '0x4B52F4', // Block around the tx time to speed up, or 0n
            toBlock: 'latest'
        });

        console.log('Logs found via getLogs:', logs.length);

        for (const log of logs) {
            console.log('Found log:', log.transactionHash);
            if (log.transactionHash === '0x6edb7dcdb8045c8142c409482568f92aa85396c7ed89d705e3d05bb3d34849e1') {
                console.log('✅ Found the specific transaction!');
                return;
            }
        }
        console.log('❌ Specific transaction NOT found in getLogs results.');
    } catch (e) {
        console.error('Error calling getLogs:', e);
    }
}

checkLogs();
