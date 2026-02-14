// DEPLOYED ON TEMPO TESTNET (MODERATO)
export const RED_PACKET_ADDRESS = "0xTODO_DEPLOY_TO_TEMPO";

export const TOKENS = [
    { symbol: "AlphaUSD", address: "0x20c0000000000000000000000000000000000001", decimals: 6, name: "Alpha USD" },
    { symbol: "BetaUSD", address: "0x20c0000000000000000000000000000000000002", decimals: 6, name: "Beta USD" },
];

// Backwards compatibility
export const STABLECOIN_ADDRESS = TOKENS[0].address;

export const CHAIN_ID = 42431; // Tempo Moderato Testnet
