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
	 * Assign a role to the user, creating it if it doesn't exist
	 */
	private async assignRole(
		params: QRActionParams,
		user: TelegramUser
	): Promise<QRActionResult> {
		try {
			console.log(`[QRActionService] Starting role assignment for user ${user.id} to role: ${params.title}`);
			
			// Check if user already has this role
			const existingUser = await this.holosphere.get(params.holonID, 'users', user.id.toString());
			
			if (existingUser && existingUser.roles && existingUser.roles.includes(params.title)) {
				console.log(`[QRActionService] User ${user.id} already has role: ${params.title}`);
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
				joined_at: new Date().toISOString(),
				last_active: new Date().toISOString()
			};

			// Add the role
			if (!userData.roles) userData.roles = [];
			if (!userData.roles.includes(params.title)) {
				userData.roles.push(params.title);
				console.log(`[QRActionService] Added role ${params.title} to user ${user.id}`);
			}

			// Update last active timestamp
			userData.last_active = new Date().toISOString();

			// Add action record
			if (!userData.actions) userData.actions = [];
			userData.actions.push({
				type: 'role_assigned',
				action: params.title,
				timestamp: Date.now(),
				description: params.desc || `Role assigned via QR code`,
				holonID: params.holonID,
				deckId: params.deckId,
				cardId: params.cardId
			});

			// Save user data
			console.log(`[QRActionService] Saving user data for user ${user.id}`);
			await this.holosphere.put(params.holonID, 'users', userData);
			console.log(`[QRActionService] User data saved successfully`);

			// Check if role exists, create it if it doesn't exist
			const roleKey = params.title; // Use title as the consistent key
			console.log(`[QRActionService] Looking for existing role with key: ${roleKey}`);
			let roleData = await this.holosphere.get(params.holonID, 'roles', roleKey);
			console.log(`[QRActionService] Retrieved role data:`, roleData);
			
			if (!roleData) {
				// Create new role with enhanced structure
				roleData = {
					id: params.title, // Use title as ID for consistency
					title: params.title,
					description: params.desc || `Role created via QR code`,
					created_at: new Date().toISOString(),
					created_by: user.id.toString(),
					created_via: 'qr_code',
					participants: [],
					permissions: [],
					status: 'active',
					holonID: params.holonID,
					deckId: params.deckId,
					cardId: params.cardId,
					metadata: {
						qr_generated: true,
						generation_timestamp: Date.now(),
						generation_source: 'qr_code'
					}
				};
				console.log(`[QRActionService] Creating new role: ${params.title} with data:`, roleData);
			} else {
				console.log(`[QRActionService] Role ${params.title} already exists, updating participants`);
			}

			// Add user to role participants if not already there
			if (!roleData.participants) roleData.participants = [];
			const existingParticipant = roleData.participants.find((p: any) => p.id === user.id.toString());
			
			if (!existingParticipant) {
				roleData.participants.push({
					id: user.id.toString(),
					username: user.username || `user_${user.id}`,
					first_name: user.first_name,
					last_name: user.last_name || '',
					assigned_at: new Date().toISOString(),
					assigned_via: 'qr_code',
					assigned_by: 'qr_code_system',
					status: 'active'
				});
				console.log(`[QRActionService] Added user ${user.id} to role participants`);
			}

			// Update role metadata
			roleData.last_modified = new Date().toISOString();
			roleData.last_modified_by = user.id.toString();

			// Save role data - Use the role's ID as the key for consistency
			console.log(`[QRActionService] Saving role data for role: ${roleData.title} with key: ${roleKey}`);
			await this.holosphere.put(params.holonID, 'roles', roleData);
			console.log(`[QRActionService] Role data saved successfully with key: ${roleKey}`);
			
			// Verify the role was saved correctly by retrieving it
			const savedRole = await this.holosphere.get(params.holonID, 'roles', roleKey);
			console.log(`[QRActionService] Verification - retrieved saved role:`, savedRole);
			if (savedRole) {
				console.log(`[QRActionService] Role saved successfully and can be retrieved`);
			} else {
				console.warn(`[QRActionService] Warning: Role was not saved correctly or cannot be retrieved`);
			}

			// Create audit log entry
			try {
				const auditLog = {
					id: `audit_${Date.now()}_${user.id}`,
					timestamp: new Date().toISOString(),
					action: 'role_assigned',
					user_id: user.id.toString(),
					username: user.username || `user_${user.id}`,
					role_title: params.title,
					holonID: params.holonID,
					deckId: params.deckId,
					cardId: params.cardId,
					description: params.desc || `Role assigned via QR code`,
					source: 'qr_code',
					metadata: {
						qr_params: params,
						user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
					}
				};

				await this.holosphere.put(params.holonID, 'audit_logs', auditLog);
				console.log(`[QRActionService] Audit log created for role assignment`);
			} catch (auditError) {
				console.warn(`[QRActionService] Failed to create audit log:`, auditError);
				// Don't fail the main operation if audit logging fails
			}

			console.log(`[QRActionService] Role assignment completed successfully for user ${user.id} to role ${params.title}`);

			return {
				success: true,
				message: `Successfully assigned role: ${params.title}`,
				assignedRole: params.title,
				redirectUrl: `/${params.holonID}/roles`
			};
		} catch (error) {
			console.error(`[QRActionService] Error assigning role:`, error);
			return {
				success: false,
				message: 'Failed to assign role. Please try again or contact support.',
				error: error instanceof Error ? error.message : 'ROLE_ASSIGNMENT_ERROR'
			};
		}
	}

	/**
	 * Join an event, creating it if it doesn't exist
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

			// Check if event exists, create it if it doesn't
			let eventData = await this.holosphere.get(params.holonID, 'events', params.title);
			if (!eventData) {
				// Create new event
				eventData = {
					title: params.title,
					description: params.desc || `Event created via QR code`,
					created_at: new Date().toISOString(),
					created_by: user.id.toString(),
					participants: [],
					status: 'active',
					start_date: new Date().toISOString(),
					end_date: null
				};
				console.log(`Creating new event: ${params.title}`);
			}

			// Add user to event participants if not already there
			if (!eventData.participants) eventData.participants = [];
			if (!eventData.participants.some((p: any) => p.id === user.id.toString())) {
				eventData.participants.push({
					id: user.id.toString(),
					username: user.username || `user_${user.id}`,
					first_name: user.first_name,
					last_name: user.last_name || '',
					joined_at: new Date().toISOString(),
					joined_via: 'qr_code'
				});
			}

			// Save event data
			await this.holosphere.put(params.holonID, 'events', eventData);

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
	 * Assign a task, creating it if it doesn't exist
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

			// Check if task exists, create it if it doesn't
			let taskData = await this.holosphere.get(params.holonID, 'tasks', params.title);
			if (!taskData) {
				// Create new task
				taskData = {
					title: params.title,
					description: params.desc || `Task created via QR code`,
					created_at: new Date().toISOString(),
					created_by: user.id.toString(),
					participants: [],
					status: 'assigned',
					priority: 'medium',
					due_date: null,
					completed_at: null
				};
				console.log(`Creating new task: ${params.title}`);
			}

			// Add user to task participants if not already there
			if (!taskData.participants) taskData.participants = [];
			if (!taskData.participants.some((p: any) => p.id === user.id.toString())) {
				taskData.participants.push({
					id: user.id.toString(),
					username: user.username || `user_${user.id}`,
					first_name: user.first_name,
					last_name: user.last_name || '',
					assigned_at: new Date().toISOString(),
					assigned_via: 'qr_code'
				});
			}

			// Save task data
			await this.holosphere.put(params.holonID, 'tasks', taskData);

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
	 * Award a badge, creating it if it doesn't exist
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

			// Check if badge exists, create it if it doesn't
			let badgeData = await this.holosphere.get(params.holonID, 'badges', params.title);
			if (!badgeData) {
				// Create new badge
				badgeData = {
					title: params.title,
					description: params.desc || `Badge created via QR code`,
					created_at: new Date().toISOString(),
					created_by: user.id.toString(),
					awarded_to: [],
					icon: '🏆',
					rarity: 'common'
				};
				console.log(`Creating new badge: ${params.title}`);
			}

			// Add user to badge recipients if not already there
			if (!badgeData.awarded_to) badgeData.awarded_to = [];
			if (!badgeData.awarded_to.some((p: any) => p.id === user.id.toString())) {
				badgeData.awarded_to.push({
					id: user.id.toString(),
					username: user.username || `user_${user.id}`,
					first_name: user.first_name,
					last_name: user.last_name || '',
					awarded_at: new Date().toISOString(),
					awarded_via: 'qr_code'
				});
			}

			// Save badge data
			await this.holosphere.put(params.holonID, 'badges', badgeData);

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
	 * Process an invite, creating it if it doesn't exist
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

			// Check if invite exists, create it if it doesn't
			let inviteData = await this.holosphere.get(params.holonID, 'invites', params.title);
			if (!inviteData) {
				// Create new invite
				inviteData = {
					title: params.title,
					description: params.desc || `Invite created via QR code`,
					created_at: new Date().toISOString(),
					created_by: params.title,
					accepted_by: [],
					status: 'active',
					expires_at: null
				};
				console.log(`Creating new invite: ${params.title}`);
			}

			// Add user to invite acceptors if not already there
			if (!inviteData.accepted_by) inviteData.accepted_by = [];
			if (!inviteData.accepted_by.some((p: any) => p.id === user.id.toString())) {
				inviteData.accepted_by.push({
					id: user.id.toString(),
					username: user.username || `user_${user.id}`,
					first_name: user.first_name,
					last_name: user.last_name || '',
					accepted_at: new Date().toISOString(),
					accepted_via: 'qr_code'
				});
			}

			// Save invite data
			await this.holosphere.put(params.holonID, 'invites', inviteData);

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
