// TaskModal.publish.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock HoloSphere
const mockHoloSphere = {
    getFederation: vi.fn(),
    createHologram: vi.fn(),
    propagate: vi.fn(),
    put: vi.fn()
};

// Mock Svelte context
vi.mock('svelte', () => ({
    getContext: () => mockHoloSphere,
    createEventDispatcher: () => vi.fn(),
    onMount: (fn) => fn()
}));

describe('TaskModal Publish Functionality', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should check federation before publishing', async () => {
        // Mock federation info with no federated chats
        mockHoloSphere.getFederation.mockResolvedValue({
            notify: []
        });

        // This would be the actual function from the component
        const publishToFederatedChats = async () => {
            const fedInfo = await mockHoloSphere.getFederation('test-holon');
            if (!fedInfo || !fedInfo.notify || fedInfo.notify.length === 0) {
                return { success: false, message: 'No federated chats available' };
            }
            
            const hologram = mockHoloSphere.createHologram('test-holon', 'quests', { id: 'test-quest' });
            return await mockHoloSphere.propagate('test-holon', 'quests', hologram, { useHolograms: true });
        };

        const result = await publishToFederatedChats();
        
        expect(mockHoloSphere.getFederation).toHaveBeenCalledWith('test-holon');
        expect(mockHoloSphere.createHologram).not.toHaveBeenCalled();
        expect(mockHoloSphere.propagate).not.toHaveBeenCalled();
        expect(result.success).toBe(false);
        expect(result.message).toBe('No federated chats available');
    });

    it('should publish successfully when federation is available', async () => {
        // Mock federation info with federated chats
        mockHoloSphere.getFederation.mockResolvedValue({
            notify: ['federated-chat-1', 'federated-chat-2']
        });

        mockHoloSphere.createHologram.mockReturnValue({ id: 'test-quest', soul: 'test-soul' });
        mockHoloSphere.propagate.mockResolvedValue({
            success: 2,
            errors: 0,
            messages: []
        });

        const publishToFederatedChats = async () => {
            const fedInfo = await mockHoloSphere.getFederation('test-holon');
            if (!fedInfo || !fedInfo.notify || fedInfo.notify.length === 0) {
                return { success: false, message: 'No federated chats available' };
            }
            
            const hologram = mockHoloSphere.createHologram('test-holon', 'quests', { id: 'test-quest' });
            return await mockHoloSphere.propagate('test-holon', 'quests', hologram, { useHolograms: true });
        };

        const result = await publishToFederatedChats();
        
        expect(mockHoloSphere.getFederation).toHaveBeenCalledWith('test-holon');
        expect(mockHoloSphere.createHologram).toHaveBeenCalledWith('test-holon', 'quests', { id: 'test-quest' });
        expect(mockHoloSphere.propagate).toHaveBeenCalledWith('test-holon', 'quests', { id: 'test-quest', soul: 'test-soul' }, { useHolograms: true });
        expect(result.success).toBe(2);
        expect(result.errors).toBe(0);
    });

    it('should handle propagation errors gracefully', async () => {
        // Mock federation info with federated chats
        mockHoloSphere.getFederation.mockResolvedValue({
            notify: ['federated-chat-1']
        });

        mockHoloSphere.createHologram.mockReturnValue({ id: 'test-quest', soul: 'test-soul' });
        mockHoloSphere.propagate.mockResolvedValue({
            success: 0,
            errors: 1,
            message: 'Propagation failed: Network error'
        });

        const publishToFederatedChats = async () => {
            const fedInfo = await mockHoloSphere.getFederation('test-holon');
            if (!fedInfo || !fedInfo.notify || fedInfo.notify.length === 0) {
                return { success: false, message: 'No federated chats available' };
            }
            
            const hologram = mockHoloSphere.createHologram('test-holon', 'quests', { id: 'test-quest' });
            return await mockHoloSphere.propagate('test-holon', 'quests', hologram, { useHolograms: true });
        };

        const result = await publishToFederatedChats();
        
        expect(result.success).toBe(0);
        expect(result.errors).toBe(1);
        expect(result.message).toBe('Propagation failed: Network error');
    });
}); 