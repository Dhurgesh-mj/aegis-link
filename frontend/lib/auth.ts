// frontend/lib/auth.ts
// Aegis-Link — Client-side authentication utilities

const TOKEN_KEY = "aegis_token";

export function saveToken(token: string): void {
    if (typeof window !== "undefined") {
        localStorage.setItem(TOKEN_KEY, token);
    }
}

export function getToken(): string | null {
    if (typeof window !== "undefined") {
        return localStorage.getItem(TOKEN_KEY);
    }
    return null;
}

export function clearToken(): void {
    if (typeof window !== "undefined") {
        localStorage.removeItem(TOKEN_KEY);
    }
}

export function isLoggedIn(): boolean {
    const token = getToken();
    if (!token) return false;
    return !isTokenExpired();
}

interface TokenPayload {
    sub: string;
    exp: number;
    iat: number;
}

export function decodeToken(token: string): { username: string; exp: number } {
    try {
        const payload = token.split(".")[1];
        const decoded = JSON.parse(atob(payload)) as TokenPayload;
        return {
            username: decoded.sub,
            exp: decoded.exp,
        };
    } catch {
        return { username: "", exp: 0 };
    }
}

export function isTokenExpired(): boolean {
    const token = getToken();
    if (!token) return true;

    try {
        const { exp } = decodeToken(token);
        // exp is in seconds, Date.now() is in milliseconds
        return Date.now() >= exp * 1000;
    } catch {
        return true;
    }
}

export function getCurrentUsername(): string {
    const token = getToken();
    if (!token) return "";
    const { username } = decodeToken(token);
    return username;
}
