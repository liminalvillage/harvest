import type HoloSphere from 'holosphere';

export interface TelegramUser {
	id: number;
	first_name: string;
	last_name?: string;
	username?: string;
	photo_url?: string;
	auth_date: number;
	hash: string;
}

export interface QRActionParams {
	action: string;
	title: string;
	desc?: string;
	holonID: string;
	deckId?: string;
	cardId?: string;
}

export interface QRActionResult {
	success: boolean;
	message: string;
	redirectUrl?: string;
	assignedRole?: string;
	error?: string;
}

export class QRActionService {
	private holosphere: HoloSphere;

	constructor(holosphere: HoloSphere) {
		this.holosphere = holosphere;
	}

	/**
	 * Process a QR code action based on the parameters
	 */
	async processQRAction(
		params: QRActionParams,
		user: TelegramUser
	): Promise<QRActionResult> {
		try {
			switch (params.action.toLowerCase()) {
				case 'role':
					return await this.assignRole(params, user);
				case 'event':
					return await this.joinEvent(params, user);
				case 'task':
					return await this.assignTask(params, user);
				case 'badge':
					return await this.awardBadge(params, user);
				case 'invite':
					return await this.processInvite(params, user);
				default:
					return {
						success: false,
						message: `Unknown action type: ${params.action}`,
						error: 'INVALID_ACTION'
					};
			}
		} catch (error) {
			console.error('Error processing QR action:', error);
			return {
				success: false,
				message: 'An error occurred while processing the action',
				error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
			};
		}
	}

	/**
	 * Assign a role to the user
	 */
	private async assignRole(
		params: QRActionParams,
		user: TelegramUser
	): Promise<QRActionResult> {
		try {
			// Check if user already has this role
			const existingUser = await this.holosphere.get(params.holonID, 'users', user.id.toString());
			
			if (existingUser && existingUser.roles && existingUser.roles.includes(params.title)) {
				return {
					success: true,
					message: `You already have the role: ${params.title}`,
					assignedRole: params.title,
					redirectUrl: `/${params.holonID}/roles`
				};
			}

			// Get or create user record
			const userData = existingUser || {
				id: user.id.toString(),
				username: user.username || `user_${user.id}`,
				first_name: user.first_name,
				last_name: user.last_name || '',
				roles: [],
				actions: [],
				joined_at: new Date().toISOString()
			};

			// Add the role
			if (!userData.roles) userData.roles = [];
			if (!userData.roles.includes(params.title)) {
				userData.roles.push(params.title);
			}

			// Add action record
			if (!userData.actions) userData.actions = [];
			userData.actions.push({
				type: 'role_assigned',
				action: params.title,
				timestamp: Date.now(),
				description: params.desc || `Role assigned via QR code`
			});

			// Save user data
			await this.holosphere.put(params.holonID, 'users', userData);

			// Update role data if it exists
			const roleData = await this.holosphere.get(params.holonID, 'roles', params.title);
			if (roleData) {
				if (!roleData.participants) roleData.participants = [];
				if (!roleData.participants.some((p: any) => p.id === user.id.toString())) {
					roleData.participants.push({
						id: user.id.toString(),
						username: user.username || `user_${user.id}`,
						first_name: user.first_name,
						last_name: user.last_name || '',
						assigned_at: new Date().toISOString()
					});
					await this.holosphere.put(params.holonID, 'roles', roleData);
				}
			}

			return {
				success: true,
				message: `Successfully assigned role: ${params.title}`,
				assignedRole: params.title,
				redirectUrl: `/${params.holonID}/roles`
			};
		} catch (error) {
			console.error('Error assigning role:', error);
			return {
				success: false,
				message: 'Failed to assign role',
				error: error instanceof Error ? error.message : 'ROLE_ASSIGNMENT_ERROR'
			};
		}
	}

	/**
	 * Join an event
	 */
	private async joinEvent(
		params: QRActionParams,
		user: TelegramUser
	): Promise<QRActionResult> {
		try {
			// Get or create user record
			const existingUser = await this.holosphere.get(params.holonID, 'users', user.id.toString());
			
			const userData = existingUser || {
				id: user.id.toString(),
				username: user.username || `user_${user.id}`,
				first_name: user.first_name,
				last_name: user.last_name || '',
				events: [],
				actions: [],
				joined_at: new Date().toISOString()
			};

			// Add event participation
			if (!userData.events) userData.events = [];
			if (!userData.events.includes(params.title)) {
				userData.events.push(params.title);
			}

			// Add action record
			if (!userData.actions) userData.actions = [];
			userData.actions.push({
				type: 'event_joined',
				action: params.title,
				timestamp: Date.now(),
				description: params.desc || `Joined event via QR code`
			});

			// Save user data
			await this.holosphere.put(params.holonID, 'users', userData);

			return {
				success: true,
				message: `Successfully joined event: ${params.title}`,
				redirectUrl: `/${params.holonID}/events`
			};
		} catch (error) {
			console.error('Error joining event:', error);
			return {
				success: false,
				message: 'Failed to join event',
				error: error instanceof Error ? error.message : 'EVENT_JOIN_ERROR'
			};
		}
	}

	/**
	 * Assign a task
	 */
	private async assignTask(
		params: QRActionParams,
		user: TelegramUser
	): Promise<QRActionResult> {
		try {
			// Get or create user record
			const existingUser = await this.holosphere.get(params.holonID, 'users', user.id.toString());
			
			const userData = existingUser || {
				id: user.id.toString(),
				username: user.username || `user_${user.id}`,
				first_name: user.first_name,
				last_name: user.last_name || '',
				tasks: [],
				actions: [],
				joined_at: new Date().toISOString()
			};

			// Add task assignment
			if (!userData.tasks) userData.tasks = [];
			if (!userData.tasks.includes(params.title)) {
				userData.tasks.push(params.title);
			}

			// Add action record
			if (!userData.actions) userData.actions = [];
			userData.actions.push({
				type: 'task_assigned',
				action: params.title,
				timestamp: Date.now(),
				description: params.desc || `Task assigned via QR code`
			});

			// Save user data
			await this.holosphere.put(params.holonID, 'users', userData);

			return {
				success: true,
				message: `Successfully assigned task: ${params.title}`,
				redirectUrl: `/${params.holonID}/tasks`
			};
		} catch (error) {
			console.error('Error assigning task:', error);
			return {
				success: false,
				message: 'Failed to assign task',
				error: error instanceof Error ? error.message : 'TASK_ASSIGNMENT_ERROR'
			};
		}
	}

	/**
	 * Award a badge
	 */
	private async awardBadge(
		params: QRActionParams,
		user: TelegramUser
	): Promise<QRActionResult> {
		try {
			// Get or create user record
			const existingUser = await this.holosphere.get(params.holonID, 'users', user.id.toString());
			
			const userData = existingUser || {
				id: user.id.toString(),
				username: user.username || `user_${user.id}`,
				first_name: user.first_name,
				last_name: user.last_name || '',
				badges: [],
				actions: [],
				joined_at: new Date().toISOString()
			};

			// Add badge
			if (!userData.badges) userData.badges = [];
			if (!userData.badges.includes(params.title)) {
				userData.badges.push(params.title);
			}

			// Add action record
			if (!userData.actions) userData.actions = [];
			userData.actions.push({
				type: 'badge_awarded',
				action: params.title,
				timestamp: Date.now(),
				description: params.desc || `Badge awarded via QR code`
			});

			// Save user data
			await this.holosphere.put(params.holonID, 'users', userData);

			return {
				success: true,
				message: `Successfully awarded badge: ${params.title}`,
				redirectUrl: `/${params.holonID}/profile`
			};
		} catch (error) {
			console.error('Error awarding badge:', error);
			return {
				success: false,
				message: 'Failed to award badge',
				error: error instanceof Error ? error.message : 'BADGE_AWARD_ERROR'
			};
		}
	}

	/**
	 * Process an invite
	 */
	private async processInvite(
		params: QRActionParams,
		user: TelegramUser
	): Promise<QRActionResult> {
		try {
			// Get or create user record
			const existingUser = await this.holosphere.get(params.holonID, 'users', user.id.toString());
			
			const userData = existingUser || {
				id: user.id.toString(),
				username: user.username || `user_${user.id}`,
				first_name: user.first_name,
				last_name: user.last_name || '',
				invited_by: params.title,
				actions: [],
				joined_at: new Date().toISOString()
			};

			// Add action record
			if (!userData.actions) userData.actions = [];
			userData.actions.push({
				type: 'invite_accepted',
				action: params.title,
				timestamp: Date.now(),
				description: params.desc || `Invite accepted via QR code`
			});

			// Save user data
			await this.holosphere.put(params.holonID, 'users', userData);

			return {
				success: true,
				message: `Successfully accepted invite from: ${params.title}`,
				redirectUrl: `/${params.holonID}`
			};
		} catch (error) {
			console.error('Error processing invite:', error);
			return {
				success: false,
				message: 'Failed to process invite',
				error: error instanceof Error ? error.message : 'INVITE_PROCESSING_ERROR'
			};
		}
	}

	/**
	 * Get available actions for a user
	 */
	async getAvailableActions(holonID: string, user: TelegramUser): Promise<string[]> {
		try {
			const userData = await this.holosphere.get(holonID, 'users', user.id.toString());
			return userData?.roles || [];
		} catch (error) {
			console.error('Error getting available actions:', error);
			return [];
		}
	}

	/**
	 * Validate QR code parameters
	 */
	validateQRParams(params: QRActionParams): { isValid: boolean; errors: string[] } {
		const errors: string[] = [];

		if (!params.action) errors.push('Action is required');
		if (!params.title) errors.push('Title is required');
		if (!params.holonID) errors.push('Holon ID is required');

		// Validate action types
		const validActions = ['role', 'event', 'task', 'badge', 'invite'];
		if (params.action && !validActions.includes(params.action.toLowerCase())) {
			errors.push(`Invalid action type. Must be one of: ${validActions.join(', ')}`);
		}

		return {
			isValid: errors.length === 0,
			errors
		};
	}
}
