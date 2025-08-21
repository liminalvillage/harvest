<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { ID } from '../dashboard/store';

	export let holonID: string = '';
	export let onAuthSuccess: (userData: TelegramUser) => void = () => {};

	interface TelegramUser {
		id: number;
		first_name: string;
		last_name?: string;
		username?: string;
		photo_url?: string;
		auth_date: number;
		hash: string;
	}

	const dispatch = createEventDispatcher();
	
	let isAuthenticated = false;
	let currentUser: TelegramUser | null = null;
	let isLoading = false;
	let errorMessage = '';
	let widgetContainer: HTMLDivElement;
	let widgetLoaded = false;

	onMount(() => {
		// Check if user is already authenticated via localStorage
		checkStoredAuth();
		
		// Only initialize Telegram Login Widget if not authenticated
		if (!isAuthenticated) {
			initTelegramWidget();
		}
	});

	function checkStoredAuth() {
		const storedUser = localStorage.getItem('telegramUser');
		const storedAuthDate = localStorage.getItem('telegramAuthDate');
		
		if (storedUser && storedAuthDate) {
			const userData = JSON.parse(storedUser);
			const authDate = parseInt(storedAuthDate);
			const currentTime = Math.floor(Date.now() / 1000);
			
			// Check if auth is still valid (24 hours)
			if (currentTime - authDate < 24 * 60 * 60) {
				handleAuthSuccess(userData);
			} else {
				// Auth expired, clear storage
				localStorage.removeItem('telegramUser');
				localStorage.removeItem('telegramAuthDate');
				// Initialize widget since user is no longer authenticated
				initTelegramWidget();
			}
		}
	}

	function initTelegramWidget() {
		// Only initialize if not already authenticated
		if (isAuthenticated) return;
		
		// Create script element for Telegram Login Widget
		const script = document.createElement('script');
		script.src = 'https://telegram.org/js/telegram-widget.js?22';
		script.setAttribute('data-telegram-login', 'HolonsBot');
		script.setAttribute('data-size', 'large');
		script.setAttribute('data-onauth', 'onTelegramAuth(user)');
		script.setAttribute('data-request-access', 'write');
		script.onload = () => {
			widgetLoaded = true;
		};
		script.onerror = () => {
			errorMessage = 'Failed to load Telegram Login Widget. This is likely due to an invalid domain configuration. Please configure your domain in BotFather using /setdomain.';
			widgetLoaded = false;
		};
		
		// Add to widget container if it exists, otherwise to body
		if (widgetContainer) {
			widgetContainer.appendChild(script);
		} else {
			document.body.appendChild(script);
		}
		
		// Define the callback function globally so Telegram can call it
		(window as any).onTelegramAuth = (user: any) => {
			console.log('Telegram auth successful:', user);
			handleAuthSuccess({
				id: user.id,
				first_name: user.first_name,
				last_name: user.last_name,
				username: user.username,
				photo_url: user.photo_url,
				auth_date: user.auth_date,
				hash: user.hash
			});
		};
	}

	function handleAuthSuccess(userData: TelegramUser) {
		isAuthenticated = true;
		currentUser = userData;
		errorMessage = '';
		
		// Call the parent callback
		onAuthSuccess(userData);
		
		// Dispatch event for other components
		dispatch('authSuccess', { user: userData });
		
		// Store user data in localStorage for persistence
		localStorage.setItem('telegramUser', JSON.stringify(userData));
		localStorage.setItem('telegramAuthDate', userData.auth_date.toString());
	}

	function handleTelegramLogin() {
		isLoading = true;
		errorMessage = '';
		
		// The widget should handle this, but just in case
		const botUsername = 'HolonsBot';
		const loginUrl = `https://t.me/${botUsername}?start=login_${holonID}`;
		
		// Open Telegram login in a new window/tab as fallback
		window.open(loginUrl, '_blank');
		
		// Set up polling to check for authentication (as fallback)
		pollForAuthentication();
	}

	function pollForAuthentication() {
		const pollInterval = setInterval(() => {
			// Check if user has completed authentication
			// This would typically involve checking a backend endpoint
			// For now, we'll simulate with a timeout
			setTimeout(() => {
				isLoading = false;
				clearInterval(pollInterval);
				
				// In a real implementation, you would check an auth endpoint
				// and verify the user's authentication status
				console.log('Authentication polling completed');
			}, 5000);
		}, 1000);
	}

	function logout() {
		isAuthenticated = false;
		currentUser = null;
		localStorage.removeItem('telegramUser');
		localStorage.removeItem('telegramAuthDate');
		
		// Re-initialize the widget after logout
		initTelegramWidget();
		
		dispatch('logout');
	}
</script>

<div class="telegram-auth">
	{#if isAuthenticated && currentUser}
		<!-- Authenticated User Display -->
		<div class="auth-success">
			<div class="user-info">
				{#if currentUser.photo_url}
					<img 
						src={currentUser.photo_url} 
						alt="{currentUser.first_name}"
						class="user-avatar"
					/>
				{:else}
					<div class="user-avatar-placeholder">
						{currentUser.first_name[0]}
					</div>
				{/if}
				<div class="user-details">
					<div class="user-name">
						{currentUser.first_name} {currentUser.last_name || ''}
					</div>
					{#if currentUser.username}
						<div class="user-username">@{currentUser.username}</div>
					{/if}
				</div>
			</div>
			<button 
				on:click={logout}
				class="logout-btn"
				title="Logout"
			>
				🚪
			</button>
		</div>
	{:else}
		<!-- Login Section - Only shown when not authenticated -->
		<div class="login-section">
			<div class="login-header">
				<div class="telegram-icon">📱</div>
				<h3>Login with Telegram</h3>
				<p class="login-description">
					Connect your Telegram account to access this holon and perform automated actions.
				</p>
			</div>
			
			{#if errorMessage}
				<div class="error-message">
					{errorMessage}
					<div class="mt-2 text-xs text-red-300">
						For local development, use 'localhost:5173' as the domain in BotFather with /setdomain command. For production, use your actual domain.
					</div>
				</div>
			{/if}
			
			<div class="login-buttons">
				<div bind:this={widgetContainer} class="telegram-widget-container mb-4"></div>
				
				<button 
					on:click={handleTelegramLogin}
					class="telegram-login-btn"
					disabled={isLoading}
				>
					{#if isLoading}
						<div class="loading-spinner"></div>
						Connecting...
					{:else}
						🔐 Login with Telegram
					{/if}
				</button>
			</div>
			
			<div class="login-info">
				<p class="info-text">
					<strong>Why Telegram?</strong> This ensures secure authentication and allows the system to know which user is performing actions.
				</p>
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
	.telegram-auth {
		width: 100%;
		max-width: 400px;
		margin: 0 auto;
	}

	.auth-success {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
		padding: 1rem;
		border-radius: 0.75rem;
		color: white;
		box-shadow: 0 4px 15px rgba(34, 197, 94, 0.3);
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.user-avatar {
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		border: 2px solid rgba(255, 255, 255, 0.3);
		object-fit: cover;
	}

	.user-avatar-placeholder {
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.2);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.25rem;
		font-weight: bold;
		border: 2px solid rgba(255, 255, 255, 0.3);
	}

	.user-details {
		.user-name {
			font-weight: 600;
			font-size: 1.125rem;
		}
		
		.user-username {
			font-size: 0.875rem;
			opacity: 0.9;
		}
	}

	.logout-btn {
		background: rgba(255, 255, 255, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.3);
		color: white;
		padding: 0.5rem;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: all 0.2s ease;
		font-size: 1.25rem;

		&:hover {
			background: rgba(255, 255, 255, 0.3);
			transform: translateY(-1px);
		}
	}

	.login-section {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 0.75rem;
		padding: 1.5rem;
		text-align: center;
	}

	.login-header {
		margin-bottom: 1.5rem;

		.telegram-icon {
			font-size: 3rem;
			margin-bottom: 1rem;
		}

		h3 {
			font-size: 1.5rem;
			font-weight: 600;
			color: white;
			margin-bottom: 0.5rem;
		}

		.login-description {
			color: rgba(255, 255, 255, 0.8);
			font-size: 0.875rem;
			line-height: 1.5;
		}
	}

	.error-message {
		background: rgba(239, 68, 68, 0.2);
		border: 1px solid rgba(239, 68, 68, 0.4);
		color: #fca5a5;
		padding: 0.75rem;
		border-radius: 0.5rem;
		margin-bottom: 1rem;
		font-size: 0.875rem;
	}

	.login-buttons {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.telegram-login-btn {
		background: linear-gradient(135deg, #0088cc 0%, #0077b3 100%);
		color: white;
		border: none;
		padding: 0.875rem 1.5rem;
		border-radius: 0.5rem;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;

		&:hover:not(:disabled) {
			transform: translateY(-1px);
			box-shadow: 0 4px 15px rgba(0, 136, 204, 0.4);
		}

		&:disabled {
			opacity: 0.7;
			cursor: not-allowed;
		}
	}

	.loading-spinner {
		width: 1rem;
		height: 1rem;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top: 2px solid white;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.login-info {
		.info-text {
			color: rgba(255, 255, 255, 0.6);
			font-size: 0.75rem;
			line-height: 1.4;
			margin: 0;
		}
	}

	.telegram-widget-container {
		width: 100%;
		text-align: center;
		margin-bottom: 1rem;
	}
</style>
