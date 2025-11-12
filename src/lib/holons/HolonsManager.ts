import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import { HolonsContract, type HolonBundle, type HolonMember, type TokenBalance, type HolonType } from './HolonsContract.js';
import { FlowSettings, type HolonSettings, type FlowVisualizationData, type LensType } from './FlowSettings.js';

export interface HolonsManagerEvents {
  'wallet:connected': (address: string) => void;
  'wallet:disconnected': () => void;
  'holon:created': (bundle: HolonBundle) => void;
  'holon:updated': (holonId: string, data: any) => void;
  'transaction:pending': (data: any) => void;
  'transaction:submitted': (data: any) => void;
  'transaction:success': (data: any) => void;
  'transaction:failed': (data: any) => void;
  'transaction:error': (data: any) => void;
  'flow:updated': (holonId: string, config: any) => void;
  'federation:added': (holonId: string, targetId: string) => void;
  'federation:removed': (holonId: string, targetId: string) => void;
  'members:added': (holonId: string, members: string[]) => void;
  'settings:updated': (holonId: string, settings: HolonSettings) => void;
}

/**
 * Main Holons Manager class that integrates smart contracts with flow visualization
 * Based on the original Holons.js and Settings.js but modernized for web frontend
 */
export class HolonsManager extends EventEmitter {
  private contract: HolonsContract;
  private flowSettings: FlowSettings;
  private gun: any;
  private currentHolon: string | null = null;
  private holonCache: Map<string, HolonBundle> = new Map();
  private settingsCache: Map<string, HolonSettings> = new Map();

  constructor(provider: ethers.Provider, gun: any) {
    super();
    
    // Create a separate EventEmitter for the contract to avoid circular references
    const contractEventEmitter = new EventEmitter();
    this.contract = new HolonsContract(provider, contractEventEmitter);
    this.flowSettings = new FlowSettings('');
    this.gun = gun;
    
    // Forward contract events
    this.setupEventForwarding(contractEventEmitter);
  }

  /**
   * Setup event forwarding from contract to manager
   */
  private setupEventForwarding(contractEventEmitter: EventEmitter): void {
    const events = [
      'wallet:connected', 'wallet:disconnected', 'transaction:pending',
      'transaction:submitted', 'transaction:success', 'transaction:failed', 'transaction:error'
    ];
    
    events.forEach(event => {
      contractEventEmitter.on(event, (data: any) => {
        // Forward the event from contract to manager listeners
        this.emit(event as any, data);
      });
    });
  }

  /**
   * Connect wallet for transactions
   */
  async connectWallet(signer: ethers.Signer): Promise<void> {
    await this.contract.connect(signer);
  }

  /**
   * Disconnect wallet
   */
  disconnectWallet(): void {
    this.contract.disconnect();
  }

  /**
   * Set current holon context
   */
  setCurrentHolon(holonId: string): void {
    this.currentHolon = holonId;
    this.flowSettings = new FlowSettings(holonId);
  }

  /**
   * Create a new holon of specified type
   */
  async createHolon(
    type: HolonType, 
    creatorUserId: string, 
    name: string
  ): Promise<{ transaction: ethers.TransactionResponse; holonId: string }> {
    const holonId = `chat_${Math.abs(parseInt(name))}`;
    
    const tx = await this.contract.createHolon(type, creatorUserId, holonId, type === 'Zoned' ? 5 : 0);
    
    // Wait for transaction and emit event
    this.contract.waitForTransaction(tx, `${type} holon created`).then(() => {
      this.emit('holon:created', {
        splitterAddress: '',
        managedAddress: '', 
        zonedAddress: '',
        creatorUserId,
        name: holonId,
        timestamp: Date.now()
      } as HolonBundle);
    });
    
    return { transaction: tx, holonId };
  }

  /**
   * Create complete holon bundle (recommended approach)
   */
  async createHolonBundle(
    creatorUserId: string,
    chatId: string
  ): Promise<{ transaction: ethers.TransactionResponse; holonId: string }> {
    const holonId = `chat_${Math.abs(parseInt(chatId))}`;
    
    const result = await this.contract.createHolonBundle(creatorUserId, holonId);
    
    // Wait for transaction and cache result
    this.contract.waitForTransaction(result.transaction, 'Holon bundle created').then(async () => {
      const bundle = await this.getHolonBundle(holonId);
      if (bundle) {
        this.holonCache.set(holonId, bundle);
        this.emit('holon:created', bundle);
      }
    });
    
    return { transaction: result.transaction, holonId };
  }

  /**
   * Get holon bundle information
   */
  async getHolonBundle(holonId: string): Promise<HolonBundle | null> {
    // Check cache first
    if (this.holonCache.has(holonId)) {
      return this.holonCache.get(holonId)!;
    }
    
    const bundle = await this.contract.getHolonBundle(holonId);
    if (bundle) {
      this.holonCache.set(holonId, bundle);
    }
    
    return bundle;
  }

  /**
   * Add members to internal (managed) holon
   */
  async addMembersToInternal(holonId: string, userIds: string[]): Promise<ethers.TransactionResponse> {
    const bundle = await this.getHolonBundle(holonId);
    if (!bundle) {
      throw new Error('Holon bundle not found');
    }
    
    const tx = await this.contract.addMembersToManaged(bundle.managedAddress, userIds);
    
    this.contract.waitForTransaction(tx, `Added ${userIds.length} members to internal holon`).then(() => {
      this.emit('members:added', holonId, userIds);
    });
    
    return tx;
  }

  /**
   * Add holons to external (zoned) holon
   */
  async addHolonsToExternal(holonId: string, holonIds: string[]): Promise<ethers.TransactionResponse> {
    const bundle = await this.getHolonBundle(holonId);
    if (!bundle) {
      throw new Error('Holon bundle not found');
    }
    
    const tx = await this.contract.addHolonsToZoned(bundle.zonedAddress, holonIds);
    
    this.contract.waitForTransaction(tx, `Added ${holonIds.length} holons to external holon`).then(() => {
      this.emit('holon:updated', holonId, { type: 'holons_added', holonIds });
    });
    
    return tx;
  }

  /**
   * Update flow split ratio between internal and external
   */
  async updateFlowSplit(holonId: string, internalPercent: number): Promise<ethers.TransactionResponse> {
    const bundle = await this.getHolonBundle(holonId);
    if (!bundle) {
      throw new Error('Holon bundle not found');
    }
    
    const tx = await this.contract.setFlowSplit(bundle.splitterAddress, internalPercent);
    
    // Update settings
    await this.flowSettings.updateFlowSettings(this.gun, holonId, {
      internalPercent,
      externalPercent: 100 - internalPercent
    });
    
    this.contract.waitForTransaction(tx, `Flow split updated to ${internalPercent}% internal`).then(() => {
      this.emit('flow:updated', holonId, { internalPercent, externalPercent: 100 - internalPercent });
    });
    
    return tx;
  }

  /**
   * Get current flow configuration
   */
  async getFlowConfiguration(holonId: string): Promise<any> {
    const bundle = await this.getHolonBundle(holonId);
    if (!bundle) {
      return null;
    }
    
    const contractConfig = await this.contract.getFlowConfig(bundle.splitterAddress);
    const settings = await this.flowSettings.loadSettings(this.gun, holonId);
    
    return {
      ...contractConfig,
      settings: settings.flowManagement
    };
  }

  /**
   * Add federation link
   */
  async addFederationLink(
    holonId: string, 
    targetId: string, 
    targetName: string, 
    relationship: 'federated' | 'notifies'
  ): Promise<void> {
    await this.flowSettings.addFederationLink(this.gun, holonId, targetId, targetName, relationship);
    this.emit('federation:added', holonId, targetId);
  }

  /**
   * Remove federation link
   */
  async removeFederationLink(holonId: string, targetId: string): Promise<void> {
    await this.flowSettings.removeFederationLink(this.gun, holonId, targetId);
    this.emit('federation:removed', holonId, targetId);
  }

  /**
   * Toggle lens for federation
   */
  async toggleFederationLens(
    holonId: string,
    targetId: string, 
    lensType: LensType,
    relationship: 'federate' | 'notify'
  ): Promise<void> {
    await this.flowSettings.toggleLens(this.gun, holonId, targetId, lensType, relationship);
    
    const settings = await this.flowSettings.loadSettings(this.gun, holonId);
    this.emit('settings:updated', holonId, settings);
  }

  /**
   * Get holon members
   */
  async getHolonMembers(holonId: string): Promise<HolonMember[]> {
    const bundle = await this.getHolonBundle(holonId);
    if (!bundle) {
      return [];
    }
    
    return this.contract.getHolonMembers(bundle.managedAddress);
  }

  /**
   * Get token balances for holon
   */
  async getHolonBalances(holonId: string, tokenAddresses: string[]): Promise<TokenBalance[]> {
    const bundle = await this.getHolonBundle(holonId);
    if (!bundle) {
      return [];
    }
    
    // Get balances for all holon contracts
    const managedBalances = await this.contract.getTokenBalances(bundle.managedAddress, tokenAddresses);
    const zonedBalances = await this.contract.getTokenBalances(bundle.zonedAddress, tokenAddresses);
    const splitterBalances = await this.contract.getTokenBalances(bundle.splitterAddress, tokenAddresses);
    
    // Combine balances
    const combinedBalances = new Map<string, TokenBalance>();
    
    [...managedBalances, ...zonedBalances, ...splitterBalances].forEach(balance => {
      const existing = combinedBalances.get(balance.address);
      if (existing) {
        existing.balance += balance.balance;
        existing.formatted = ethers.formatUnits(existing.balance, existing.decimals);
      } else {
        combinedBalances.set(balance.address, { ...balance });
      }
    });
    
    return Array.from(combinedBalances.values());
  }

  /**
   * Generate comprehensive flow visualization
   */
  async generateFlowVisualization(holonId: string): Promise<FlowVisualizationData> {
    const [bundle, members, settings] = await Promise.all([
      this.getHolonBundle(holonId),
      this.getHolonMembers(holonId),
      this.flowSettings.loadSettings(this.gun, holonId)
    ]);
    
    if (!bundle) {
      throw new Error('Holon bundle not found');
    }
    
    // Get token balances for visualization
    const commonTokens = [
      process.env.VITE_TEST_TOKEN_ADDRESS || '0x...'
    ].filter(addr => addr !== '0x...');
    
    const tokenBalances = await this.getHolonBalances(holonId, commonTokens);
    
    return this.flowSettings.generateFlowVisualization(holonId, bundle, members, tokenBalances);
  }

  /**
   * Get holon settings
   */
  async getHolonSettings(holonId: string): Promise<HolonSettings> {
    if (this.settingsCache.has(holonId)) {
      return this.settingsCache.get(holonId)!;
    }
    
    const settings = await this.flowSettings.loadSettings(this.gun, holonId);
    this.settingsCache.set(holonId, settings);
    
    return settings;
  }

  /**
   * Update holon settings
   */
  async updateHolonSettings(holonId: string, updates: Partial<HolonSettings>): Promise<void> {
    await this.flowSettings.saveSettings(this.gun, holonId, updates);
    
    const updatedSettings = await this.getHolonSettings(holonId);
    this.settingsCache.set(holonId, updatedSettings);
    
    this.emit('settings:updated', holonId, updatedSettings);
  }

  /**
   * Get available holon types
   */
  async getAvailableHolonTypes(): Promise<HolonType[]> {
    return this.contract.getAvailableHolonTypes();
  }

  /**
   * Get holon type icon
   */
  getHolonTypeIcon(type: HolonType): string {
    return this.contract.getHolonIcon(type);
  }

  /**
   * Check if wallet is connected
   */
  isWalletConnected(): boolean {
    return this.contract.isConnected();
  }

  /**
   * Get connected wallet address
   */
  async getWalletAddress(): Promise<string | null> {
    return this.contract.getWalletAddress();
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.holonCache.clear();
    this.settingsCache.clear();
    this.flowSettings.clearCache();
  }

  /**
   * Subscribe to specific holon events
   */
  onHolonEvent(holonId: string, event: string, callback: Function): void {
    this.on(event, (eventHolonId: string, ...args: any[]) => {
      if (eventHolonId === holonId) {
        callback(...args);
      }
    });
  }

  /**
   * Get comprehensive holon status
   */
  async getHolonStatus(holonId: string): Promise<{
    bundle: HolonBundle | null;
    members: HolonMember[];
    settings: HolonSettings;
    balances: TokenBalance[];
    flowConfig: any;
    visualization: FlowVisualizationData;
  }> {
    console.log(`[HolonsManager] Getting holon status for: ${holonId}`);
    
    const [bundle, members, settings, flowConfig] = await Promise.all([
      this.getHolonBundle(holonId),
      this.getHolonMembers(holonId),
      this.getHolonSettings(holonId),
      this.getFlowConfiguration(holonId)
    ]);
    
    console.log(`[HolonsManager] Bundle result:`, bundle);
    console.log(`[HolonsManager] Members result:`, members);
    console.log(`[HolonsManager] Settings result:`, settings);
    
    const balances = bundle ? await this.getHolonBalances(holonId, []) : [];
    const visualization = await this.generateFlowVisualization(holonId);
    
    const status = {
      bundle,
      members,
      settings,
      balances,
      flowConfig,
      visualization
    };
    
    console.log(`[HolonsManager] Final holon status:`, status);
    
    return status;
  }
}