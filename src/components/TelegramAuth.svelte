<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
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
	let errorMessage = '';
	let widgetContainer: HTMLDivElement;
	let widgetLoaded = false;
	let widgetLoadAttempts = 0;
	const MAX_WIDGET_ATTEMPTS = 3;
	
	// Manual authentication fallback variables
	let manualUserId = '';
	let manualFirstName = '';
	let manualUsername = '';
	
	// Notification system
	let showNotification = false;
	let notificationMessage = '';
	let notificationType = 'success'; // 'success' or 'error'

	onMount(() => {
		// Check if user is already authenticated via localStorage
		checkStoredAuth();
		
		// Only initialize Telegram Login Widget if not authenticated
		if (!isAuthenticated) {
			// Add a small delay to ensure the component is fully mounted
			setTimeout(() => {
				if (!isAuthenticated) {
					initTelegramWidget();
				}
			}, 100);
		}
		
		// Also check for URL parameters that might indicate successful auth
		const urlParams = new URLSearchParams(window.location.search);
		const telegramAuth = urlParams.get('telegram_auth');
		if (telegramAuth && !isAuthenticated) {
			try {
				const authData = JSON.parse(decodeURIComponent(telegramAuth));
				if (authData.id && authData.first_name) {
					handleAuthSuccess(authData);
					// Clean up URL parameter
					urlParams.delete('telegram_auth');
					const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
					window.history.replaceState({}, '', newUrl);
				}
			} catch (error) {
				console.warn('Could not parse Telegram auth data from URL:', error);
			}
		}
	});

	onDestroy(() => {
		// Clean up global callback function to prevent memory leaks
		if ((window as any).onTelegramAuth) {
			delete (window as any).onTelegramAuth;
		}
	});

	function checkStoredAuth() {
		try {
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
		} catch (error) {
			console.error('Error checking stored authentication:', error);
			// Clear corrupted data and reinitialize
			localStorage.removeItem('telegramUser');
			localStorage.removeItem('telegramAuthDate');
			initTelegramWidget();
		}
	}

	function initTelegramWidget() {
		// Only initialize if not already authenticated
		if (isAuthenticated) return;
		
		// Prevent too many attempts
		if (widgetLoadAttempts >= MAX_WIDGET_ATTEMPTS) {
			errorMessage = 'Unable to load Telegram Login Widget after multiple attempts. Please refresh the page or try again later.';
			return;
		}
		
		widgetLoadAttempts++;
		
		try {
			// Clear any existing widget
			if (widgetContainer) {
				widgetContainer.innerHTML = '';
			}
			
			// Create script element for Telegram Login Widget
			const script = document.createElement('script');
			script.src = 'https://telegram.org/js/telegram-widget.js?22';
			script.setAttribute('data-telegram-login', 'HolonsBot');
			script.setAttribute('data-size', 'large');
			script.setAttribute('data-onauth', 'onTelegramAuth(user)');
			script.setAttribute('data-request-access', 'write');
			script.setAttribute('data-radius', '8');
			
			script.onload = () => {
				widgetLoaded = true;
				errorMessage = '';
				console.log('Telegram Login Widget loaded successfully');
			};
			
			script.onerror = () => {
				widgetLoaded = false;
				console.error('Failed to load Telegram Login Widget');
				
				// Provide more helpful error messages
				if (widgetLoadAttempts >= MAX_WIDGET_ATTEMPTS) {
					const errorMsg = 'Unable to load Telegram Login Widget. This may be due to network issues or domain configuration. Please check your internet connection and try again.';
					errorMessage = errorMsg;
					showErrorNotification(errorMsg);
				} else {
					errorMessage = 'Failed to load Telegram Login Widget. Retrying...';
					// Retry after a short delay
					setTimeout(() => {
						if (!isAuthenticated) {
							initTelegramWidget();
						}
					}, 2000);
				}
			};
			
			// Add to widget container if it exists, otherwise to body
			if (widgetContainer) {
				widgetContainer.appendChild(script);
			} else {
				document.body.appendChild(script);
			}
			
			// Define the callback function globally so Telegram can call it
			(window as any).onTelegramAuth = (user: any) => {
				try {
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
				} catch (error) {
					console.error('Error handling Telegram auth success:', error);
					const authErrorMsg = 'Authentication succeeded but there was an error processing the user data. Please try again.';
					errorMessage = authErrorMsg;
					showErrorNotification(authErrorMsg);
				}
			};
			
			// Set a timeout to detect if the widget fails to load
			setTimeout(() => {
				if (!widgetLoaded && !isAuthenticated) {
					console.warn('Telegram widget load timeout');
					if (widgetLoadAttempts < MAX_WIDGET_ATTEMPTS) {
						const timeoutMsg = 'Widget is taking longer than expected to load. Retrying...';
						errorMessage = timeoutMsg;
						showErrorNotification(timeoutMsg);
						setTimeout(() => {
							if (!isAuthenticated) {
								initTelegramWidget();
							}
						}, 3000);
					}
				}
			}, 10000); // 10 second timeout
			
		} catch (error) {
			console.error('Error initializing Telegram widget:', error);
			const initErrorMsg = 'Failed to initialize Telegram Login Widget. Please try refreshing the page.';
			errorMessage = initErrorMsg;
			showErrorNotification(initErrorMsg);
			widgetLoaded = false;
		}
	}

	function handleAuthSuccess(userData: TelegramUser) {
		isAuthenticated = true;
		currentUser = userData;
		errorMessage = '';
		widgetLoaded = false;
		widgetLoadAttempts = 0;
		
		// Show success notification
		showNotification = true;
		notificationMessage = `Welcome, ${userData.first_name}! Authentication successful.`;
		notificationType = 'success';
		
		// Hide notification after 3 seconds
		setTimeout(() => {
			showNotification = false;
		}, 3000);
		
		// Only call the parent callback if it's actually provided and is a function
		if (typeof onAuthSuccess === 'function') {
			try {
				onAuthSuccess(userData);
			} catch (error) {
				console.warn('Error in onAuthSuccess callback:', error);
				// Continue with authentication success even if callback fails
			}
		}
		
		// Dispatch event for other components
		dispatch('authSuccess', { user: userData });
		
		// Store user data in localStorage for persistence
		localStorage.setItem('telegramUser', JSON.stringify(userData));
		localStorage.setItem('telegramAuthDate', userData.auth_date.toString());
	}

	function handleTelegramLogin() {
		// Reset and retry the widget
		errorMessage = '';
		widgetLoadAttempts = 0;
		widgetLoaded = false;
		initTelegramWidget();
	}

	function logout() {
		isAuthenticated = false;
		currentUser = null;
		widgetLoadAttempts = 0;
		widgetLoaded = false;
		localStorage.removeItem('telegramUser');
		localStorage.removeItem('telegramAuthDate');
		
		// Re-initialize the widget after logout
		initTelegramWidget();
		
		dispatch('logout');
	}

	function refreshPage() {
		// Simple page refresh as a last resort
		window.location.reload();
	}

	function showErrorNotification(message: string) {
		showNotification = true;
		notificationMessage = message;
		notificationType = 'error';
		setTimeout(() => { showNotification = false; }, 5000);
	}

	function handleManualAuth() {
		if (!manualUserId || !manualFirstName) {
			showErrorNotification('Please enter your Telegram ID and First Name.');
			return;
		}

		try {
			// Create a mock user object for manual authentication
			const manualUser: TelegramUser = {
				id: parseInt(manualUserId),
				first_name: manualFirstName,
				last_name: '',
				username: manualUsername || undefined,
				photo_url: '',
				auth_date: Math.floor(Date.now() / 1000),
				hash: 'manual_auth_' + Date.now()
			};

			// Validate the user ID is a number
			if (isNaN(manualUser.id)) {
				showErrorNotification('Please enter a valid Telegram ID (numbers only).');
				return;
			}

			// Process the manual authentication
			handleAuthSuccess(manualUser);
			
			// Clear manual input fields
			manualUserId = '';
			manualFirstName = '';
			manualUsername = '';
			
		} catch (error) {
			console.error('Error in manual authentication:', error);
			showErrorNotification('Error processing manual authentication. Please try again.');
		}
	}
</script>

<div class="telegram-auth">
	<!-- Notification System -->
	{#if showNotification}
		<div class="notification notification-{notificationType}">
			<div class="notification-content">
				<span class="notification-icon">
					{#if notificationType === 'success'}
						✅
					{:else}
						⚠️
					{/if}
				</span>
				<span class="notification-message">{notificationMessage}</span>
			</div>
			<button 
				on:click={() => showNotification = false}
				class="notification-close"
				title="Close notification"
			>
				×
			</button>
		</div>
	{/if}

	{#if isAuthenticated && currentUser}
		<!-- Authenticated User Display -->
		<div class="auth-success">
			<div class="success-indicator">✅</div>
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
					<div class="auth-status">Successfully authenticated</div>
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
					<div class="error-title">⚠️ Authentication Error</div>
					<div class="error-description">{errorMessage}</div>
					<div class="error-actions">
						<button 
							on:click={() => {
								errorMessage = '';
								widgetLoadAttempts = 0;
								initTelegramWidget();
							}}
							class="retry-btn"
						>
							🔄 Retry
						</button>
						<button 
							on:click={refreshPage}
							class="refresh-btn"
						>
							🔄 Refresh Page
						</button>
					</div>
				</div>
				
				<!-- Fallback Authentication Section -->
				{#if widgetLoadAttempts >= MAX_WIDGET_ATTEMPTS}
					<div class="fallback-auth">
						<div class="fallback-header">
							<div class="fallback-icon">🔧</div>
							<h4>Alternative Authentication</h4>
							<p>Since the Telegram widget is unavailable, you can use one of these alternatives:</p>
						</div>
						
						<div class="fallback-options">
							<!-- Manual Entry Option -->
							<div class="fallback-option">
								<h5>Manual Entry</h5>
								<p>Enter your Telegram user information manually:</p>
								<div class="manual-inputs">
									<input 
										type="text" 
										placeholder="Your Telegram ID (e.g., 123456789)"
										class="manual-input"
										bind:value={manualUserId}
									/>
									<input 
										type="text" 
										placeholder="Your First Name"
										class="manual-input"
										bind:value={manualFirstName}
									/>
									<input 
										type="text" 
										placeholder="Your Username (optional)"
										class="manual-input"
										bind:value={manualUsername}
									/>
									<button 
										on:click={handleManualAuth}
										class="manual-auth-btn"
										disabled={!manualUserId || !manualFirstName}
									>
										✅ Authenticate Manually
									</button>
								</div>
							</div>
							
							<!-- Contact Support Option -->
							<div class="fallback-option">
								<h5>Need Help?</h5>
								<p>If you continue to experience issues:</p>
								<ul class="support-list">
									<li>• Check your internet connection</li>
									<li>• Try refreshing the page</li>
									<li>• Contact support if the problem persists</li>
								</ul>
							</div>
						</div>
					</div>
				{/if}
			{/if}
			
			<div class="login-buttons">
				{#if !widgetLoaded && !errorMessage}
					<div class="widget-loading">
						<div class="loading-spinner"></div>
						<span>Loading Telegram Login Widget...</span>
					</div>
				{/if}
				
				<div bind:this={widgetContainer} class="telegram-widget-container mb-4"></div>
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

	.auth-success,
	.login-section {
		animation: slideIn 0.3s ease-out;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
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
		position: relative;
	}

	.success-indicator {
		position: absolute;
		top: -0.5rem;
		left: -0.5rem;
		background: #22c55e;
		border: 2px solid white;
		border-radius: 50%;
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-left: 1.5rem;
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

		.auth-status {
			font-size: 0.75rem;
			opacity: 0.8;
			margin-top: 0.25rem;
			font-style: italic;
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
		background: rgba(239, 68, 68, 0.15);
		border: 1px solid rgba(239, 68, 68, 0.4);
		color: #fca5a5;
		padding: 1rem;
		border-radius: 0.75rem;
		margin-bottom: 1rem;
		font-size: 0.875rem;
		text-align: left;
	}

	.error-title {
		font-weight: 600;
		font-size: 1rem;
		margin-bottom: 0.5rem;
		color: #fecaca;
	}

	.error-description {
		margin-bottom: 0.75rem;
		line-height: 1.4;
	}

	.error-actions {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.retry-btn {
		background: linear-gradient(135deg, #0088cc 0%, #0077b3 100%);
		color: white;
		border: none;
		padding: 0.625rem 1.25rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		display: inline-block;

		&:hover:not(:disabled) {
			transform: translateY(-1px);
			box-shadow: 0 4px 15px rgba(0, 136, 204, 0.4);
		}

		&:disabled {
			opacity: 0.7;
			cursor: not-allowed;
		}
	}

	.refresh-btn {
		background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
		color: white;
		border: none;
		padding: 0.625rem 1.25rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		display: inline-block;

		&:hover:not(:disabled) {
			transform: translateY(-1px);
			box-shadow: 0 4px 15px rgba(79, 70, 229, 0.4);
		}

		&:disabled {
			opacity: 0.7;
			cursor: not-allowed;
		}
	}

	.login-buttons {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.widget-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
		color: rgba(255, 255, 255, 0.8);
		font-size: 0.875rem;
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

	.fallback-auth {
		background: rgba(59, 130, 246, 0.1);
		border: 1px solid rgba(59, 130, 246, 0.3);
		border-radius: 0.75rem;
		padding: 1.5rem;
		margin-top: 1rem;
		text-align: left;
	}

	.fallback-header {
		text-align: center;
		margin-bottom: 1.5rem;

		.fallback-icon {
			font-size: 2rem;
			margin-bottom: 0.5rem;
		}

		h4 {
			font-size: 1.25rem;
			font-weight: 600;
			color: #3b82f6;
			margin-bottom: 0.5rem;
		}

		p {
			color: rgba(255, 255, 255, 0.8);
			font-size: 0.875rem;
			line-height: 1.4;
		}
	}

	.fallback-options {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.fallback-option {
		h5 {
			font-size: 1rem;
			font-weight: 600;
			color: white;
			margin-bottom: 0.5rem;
		}

		p {
			color: rgba(255, 255, 255, 0.7);
			font-size: 0.875rem;
			margin-bottom: 1rem;
		}
	}

	.manual-inputs {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.manual-input {
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: white;
		padding: 0.75rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		transition: all 0.2s ease;

		&::placeholder {
			color: rgba(255, 255, 255, 0.5);
		}

		&:focus {
			outline: none;
			border-color: #3b82f6;
			background: rgba(255, 255, 255, 0.15);
		}
	}

	.manual-auth-btn {
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		margin-top: 0.5rem;

		&:hover:not(:disabled) {
			transform: translateY(-1px);
			box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}

	.support-list {
		list-style: none;
		padding: 0;
		margin: 0;

		li {
			color: rgba(255, 255, 255, 0.7);
			font-size: 0.875rem;
			margin-bottom: 0.25rem;
			padding-left: 0.5rem;
		}
	}

	/* Notification Styles */
	.notification {
		position: fixed;
		top: 10px;
		right: 10px;
		background-color: #4ade80; /* Default to success color */
		color: white;
		padding: 10px 20px;
		border-radius: 8px;
		box-shadow: 0 4px 15px rgba(74, 222, 128, 0.3);
		display: flex;
		align-items: center;
		justify-content: space-between;
		z-index: 1000;
		opacity: 0.95;
		transition: opacity 0.5s ease-in-out;
	}

	.notification.error {
		background-color: #ef4444; /* Red for error */
		box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
	}

	.notification-content {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.notification-icon {
		font-size: 1.25rem;
	}

	.notification-message {
		font-size: 0.9rem;
		font-weight: 500;
	}

	.notification-close {
		background: none;
		border: none;
		color: white;
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0 5px;
		opacity: 0.7;
		transition: opacity 0.2s ease;

		&:hover {
			opacity: 1;
		}
	}
</style>
