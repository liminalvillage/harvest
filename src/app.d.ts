// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface Platform {}
	}
}

export {};

/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_LOCAL_MODE: string
	// Add other env vars here
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}
