import { advisorStateManager } from './advisor-state';
import type { CouncilAdvisorExtended } from '../types/advisor-schema';
import { resolveAdvisor } from './advisor-lookup';

// Centralized advisor operations following holonic principles
export class AdvisorOperations {
  
  // Add advisor to ritual (single source of truth)
  static addAdvisorToRitual(advisor: CouncilAdvisorExtended): void {
    advisorStateManager.addRitualAdvisor(advisor);
    advisorStateManager.logState('addAdvisorToRitual');
  }

  // Remove advisor from ritual
  static removeAdvisorFromRitual(index: number): void {
    advisorStateManager.removeRitualAdvisor(index);
    advisorStateManager.logState('removeAdvisorFromRitual');
  }

  // Get advisors for Glass Bead Game (always from ritual advisors)
  static getGlassBeadGameAdvisors(): CouncilAdvisorExtended[] {
    const ritualAdvisors = advisorStateManager.getRitualAdvisors();
    advisorStateManager.setGlassBeadGameAdvisors(ritualAdvisors);
    advisorStateManager.logState('getGlassBeadGameAdvisors');
    return ritualAdvisors;
  }

  // Set advisors for Glass Bead Game
  static setGlassBeadGameAdvisors(advisors: CouncilAdvisorExtended[]): void {
    advisorStateManager.setGlassBeadGameAdvisors(advisors);
    advisorStateManager.logState('setGlassBeadGameAdvisors');
  }

  // Get advisors for council chat (use Glass Bead Game advisors if available)
  static getCouncilChatAdvisors(): CouncilAdvisorExtended[] {
    const glassBeadGameAdvisors = advisorStateManager.getGlassBeadGameAdvisors();
    if (glassBeadGameAdvisors.length > 0) {
      return glassBeadGameAdvisors;
    }
    
    // Fallback to ritual advisors
    const ritualAdvisors = advisorStateManager.getRitualAdvisors();
    advisorStateManager.logState('getCouncilChatAdvisors');
    return ritualAdvisors;
  }

  // Convert circle inputs to advisors (for Holonic Ecosystem Council)
  static convertCircleInputsToAdvisors(circleInputs: Record<string, string>): CouncilAdvisorExtended[] {
    const advisors: CouncilAdvisorExtended[] = [];
    const outerPositions = ['outer-top', 'outer-top-right', 'outer-bottom-right', 'outer-bottom', 'outer-bottom-left', 'outer-top-left'];
    
    outerPositions.forEach(position => {
      const advisorName = circleInputs[position];
      if (advisorName) {
        const fullAdvisor = resolveAdvisor(advisorName);
        if (fullAdvisor) {
          advisors.push(fullAdvisor);
        }
      }
    });
    
    return advisors;
  }

  // Get ritual advisors
  static getRitualAdvisors(): CouncilAdvisorExtended[] {
    return advisorStateManager.getRitualAdvisors();
  }

  // Clear Glass Bead Game advisors (when starting new ritual or closing chat)
  static clearGlassBeadGameAdvisors(): void {
    advisorStateManager.setGlassBeadGameAdvisors([]);
    advisorStateManager.logState('clearGlassBeadGameAdvisors');
  }

  // Clear all advisor state (when starting new ritual)
  static clearAllAdvisorState(): void {
    advisorStateManager.clearAll();
    advisorStateManager.logState('clearAllAdvisorState');
  }

  // Load advisors from HoloSphere (for circle inputs only)
  static async loadAdvisorsFromHoloSphere(holosphere: any, holonID: string): Promise<Record<string, string>> {
    try {
      const advisorsData = await holosphere.get(holonID, "council_advisors", holonID);
      if (advisorsData && typeof advisorsData === 'object') {
        advisorStateManager.setCircleAdvisors(advisorsData);
        advisorStateManager.logState('loadAdvisorsFromHoloSphere');
        return advisorsData;
      }
    } catch (error) {
      console.error('Error loading advisors from HoloSphere:', error);
    }
    return {};
  }

  // Save advisors to HoloSphere (circle inputs only)
  static async saveAdvisorsToHoloSphere(holosphere: any, holonID: string): Promise<void> {
    try {
      const circleAdvisors = advisorStateManager.getCircleAdvisors();
      await holosphere.put(holonID, "council_advisors", circleAdvisors);
      advisorStateManager.logState('saveAdvisorsToHoloSphere');
    } catch (error) {
      console.error('Error saving advisors to HoloSphere:', error);
    }
  }

  // Load previous advisors from HoloSphere
  static async loadPreviousAdvisorsFromHoloSphere(holosphere: any, holonID: string): Promise<void> {
    try {
      const advisorsData = await holosphere.get(holonID, "ritual_previous_advisors", holonID);
      if (advisorsData && Array.isArray(advisorsData)) {
        advisorStateManager.setPreviousAdvisors(advisorsData);
        advisorStateManager.logState('loadPreviousAdvisorsFromHoloSphere');
      }
    } catch (error) {
      console.log('No previous advisors found');
    }
  }

  // Save previous advisors to HoloSphere
  static async savePreviousAdvisorsToHoloSphere(holosphere: any, holonID: string): Promise<void> {
    try {
      const previousAdvisors = advisorStateManager.getPreviousAdvisors();
      if (previousAdvisors.length > 0) {
        await holosphere.put(holonID, "ritual_previous_advisors", previousAdvisors);
        advisorStateManager.logState('savePreviousAdvisorsToHoloSphere');
      }
    } catch (error) {
      console.error('Error saving previous advisors to HoloSphere:', error);
    }
  }

  // Add advisor to previous advisors (for history)
  static addAdvisorToPrevious(advisor: CouncilAdvisorExtended): void {
    const previousAdvisors = advisorStateManager.getPreviousAdvisors();
    const exists = previousAdvisors.some(a => 
      a.name === advisor.name && a.lens === advisor.lens
    );
    if (!exists) {
      advisorStateManager.setPreviousAdvisors([...previousAdvisors, advisor]);
      advisorStateManager.logState('addAdvisorToPrevious');
    }
  }

  // Validate advisor exists in library
  static validateAdvisor(advisorName: string): CouncilAdvisorExtended | null {
    const advisor = resolveAdvisor(advisorName);
    if (!advisor) {
      console.error(`❌ Advisor lookup failed for "${advisorName}"`);
      return null;
    }
    return advisor;
  }
} 