// DEPLOYED ON TEMPO TESTNET (MODERATO)
// DEPLOYED ON TEMPO TESTNET (MODERATO)
export const RED_PACKET_ADDRESS = "0x936E971fF83A57D2F2a0D2F78FDd2a39a329d83a";

export const TOKENS = [
    { symbol: "pathUSD", address: "0x20c0000000000000000000000000000000000000", decimals: 6, name: "Path USD" },
    { symbol: "AlphaUSD", address: "0x20c0000000000000000000000000000000000001", decimals: 6, name: "Alpha USD" },
    { symbol: "BetaUSD", address: "0x20c0000000000000000000000000000000000002", decimals: 6, name: "Beta USD" },
    { symbol: "ThetaUSD", address: "0x20c0000000000000000000000000000000000003", decimals: 6, name: "Theta USD" },
];

// Backwards compatibility
export const STABLECOIN_ADDRESS = TOKENS[0].address;

export const CHAIN_ID = 42431; // Tempo Moderato Testnet
