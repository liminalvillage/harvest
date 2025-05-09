import { SiweMessage } from 'siwe';
import { json, error } from '@sveltejs/kit';
import jwt from 'jsonwebtoken'; // Import jsonwebtoken
// Assuming holosphere is initialized and exports the gun instance
// Adjust the import path based on your project structure
import holosphere from '$lib/server/holosphere'; // EXAMPLE IMPORT PATH

// IMPORTANT: Replace with a strong secret, ideally from environment variables (e.g., process.env.JWT_SECRET)
const JWT_SECRET = process.env.JWT_SECRET || 'YOUR_VERY_STRONG_SECRET_KEY_REPLACE_THIS_NOW';
const JWT_EXPIRES_IN = '1h'; // Token will expire in 1 hour

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, cookies, platform }) { // Added platform for env vars if needed later
    try {
        const { message, signature } = await request.json();

        if (!message || !signature) {
            throw error(400, { message: 'Missing message or signature' });
        }

        const storedNonce = cookies.get('nonce');
        if (!storedNonce) {
            // Nonce might have expired or was never set
            throw error(400, { message: 'Nonce not found or expired. Please request a new one.'});
        }

        const siweMessage = new SiweMessage(message);

        // Verify the SIWE message
        // The nonce from the message will be compared against the one we expect (storedNonce)
        const fields = await siweMessage.verify({ signature, nonce: storedNonce });

        if (fields.data.nonce !== storedNonce) {
            // This case should ideally be caught by siweMessage.verify if nonces don't match its expectation
            cookies.delete('nonce', { path: '/' }); // Clear the used/invalid nonce
            throw error(422, { message: 'Invalid nonce.' });
        }
        
        cookies.delete('nonce', { path: '/' }); // Clear the used nonce, it's single-use

        const walletAddress = fields.data.address;
        const chainId = fields.data.chainId;
        const siweDomain = fields.data.domain; // from SIWE message
        const siweUri = fields.data.uri; // from SIWE message
        const siweIssuedAt = fields.data.issuedAt; // from SIWE message

        // --- Holosphere/GunDB User Interaction --- 
        const userNode = holosphere.gun.get('users').get(walletAddress);

        const existingUserData = await new Promise(resolve => {
            userNode.once(data => resolve(data));
        });

        const currentTime = new Date().toISOString();
        let userRecord;

        if (!existingUserData || Object.keys(existingUserData).filter(k => k !== '_').length === 0) { // Check if undefined or an empty object (excluding Gun's metadata '_')
            console.log(`Creating new user in GunDB for address: ${walletAddress}`);
            userRecord = {
                _id: walletAddress, // Using walletAddress as a unique ID
                address: walletAddress,
                chainId: chainId,
                createdAt: currentTime,
                lastLogin: currentTime,
                // You might want to store initial SIWE details for context
                siweDomainOnCreation: siweDomain,
                siweUriOnCreation: siweUri,
                siweVersion: fields.data.version
            };
            userNode.put(userRecord);
        } else {
            console.log(`User found in GunDB, updating lastLogin for address: ${walletAddress}`);
            // Merge new login time. GunDB handles partial updates.
            userNode.put({ lastLogin: currentTime }); 
            userRecord = { ...existingUserData, lastLogin: currentTime, address: walletAddress, chainId: chainId }; // Construct the most up-to-date record for JWT
        }
        // --- End Holosphere/GunDB Interaction ---

        // The 'user' object for the JWT payload
        const tokenUser = { 
            id: walletAddress, // id for JWT sub claim
            address: userRecord.address,
            chainId: userRecord.chainId,
            createdAt: userRecord.createdAt,
            lastLogin: userRecord.lastLogin
        };

        // Generate JWT
        const tokenPayload = {
            sub: tokenUser.id,
            address: tokenUser.address,
            chainId: tokenUser.chainId,
            createdAt: tokenUser.createdAt, // Include creation timestamp in JWT
            lastLogin: tokenUser.lastLogin, // Include last login in JWT
            iss: siweDomain,
            aud: siweUri,
            iat: Math.floor(Date.now() / 1000),
            nonce: fields.data.nonce
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        // Set JWT in an HttpOnly cookie
        cookies.set('session_token', token, {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Set to true if served over HTTPS
            maxAge: parseInt(JWT_EXPIRES_IN) * 60 * 60, // Convert JWT_EXPIRES_IN (e.g., '1h') to seconds for maxAge
            sameSite: 'lax'
        });

        // Return user info that is safe for the client
        return json({ ok: true, user: { address: tokenUser.address, chainId: tokenUser.chainId, createdAt: tokenUser.createdAt } });

    } catch (e) {
        cookies.delete('nonce', { path: '/' }); // Attempt to clear nonce on any error
        
        // Check if it's a SvelteKit HttpError (approximated check for JS)
        if (typeof e === 'object' && e !== null && 
            'status' in e && typeof e.status === 'number' && 
            'body' in e && typeof e.body === 'object' && e.body !== null && 
            'message' in e.body && typeof e.body.message === 'string') {
            // Now TypeScript/linter should be happier with accessing these properties
            return json({ ok: false, message: e.body.message }, { status: e.status });
        }
        // Check if it's a SiweError (approximated check for JS)
        else if (typeof e === 'object' && e !== null && 
                 'name' in e && e.name === 'SiweError' && 
                 'message' in e && typeof e.message === 'string') {
            // Now TypeScript/linter should be happier with accessing e.message
            return json({ ok: false, message: e.message || 'SIWE verification failed.' }, { status: 401 });
        }
        // General Error instance
        else if (e instanceof Error) {
            console.error('Verification error (General Error):', e);
            return json({ ok: false, message: e.message || 'An unexpected error occurred.' }, { status: 500 });
        }
        // Fallback for other unknown error types
        else {
            console.error('Verification error (Unknown type):', e);
            return json({ ok: false, message: 'An unexpected error occurred.' }, { status: 500 });
        }
    }
} 