import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function hexToBase64(hex: string): string {
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    const match = cleanHex.match(/.{1,2}/g);
    if (!match) return '';
    const bytes = new Uint8Array(match.map(byte => parseInt(byte, 16)));
    const binary = String.fromCharCode(...bytes);
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

export function base64ToHex(base64: string): string {
    const base64Standard = base64
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    // Add padding if needed
    const pad = base64Standard.length % 4;
    const padded = pad ? base64Standard + '='.repeat(4 - pad) : base64Standard;

    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return '0x' + Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
