import type { CouncilAdvisorExtended } from '../types/advisor-schema';
import { resolveAdvisor, resolveAdvisorsFromRitual } from './advisor-lookup';

// Single source of truth for advisor state
export interface AdvisorState {
  ritualAdvisors: CouncilAdvisorExtended[];  // Advisors in current ritual
  circleAdvisors: Record<string, string>;    // Circle positions
  previousAdvisors: CouncilAdvisorExtended[]; // Historical advisors
  glassBeadGameAdvisors: CouncilAdvisorExtended[]; // Active Glass Bead Game advisors
}

class AdvisorStateManager {
  private state: AdvisorState = {
    ritualAdvisors: [],
    circleAdvisors: {},
    previousAdvisors: [],
    glassBeadGameAdvisors: []
  };

  // Clear all advisor state
  clearAll(): void {
    this.state = {
      ritualAdvisors: [],
      circleAdvisors: {},
      previousAdvisors: [],
      glassBeadGameAdvisors: []
    };
  }

  // Ritual advisors (single source of truth)
  getRitualAdvisors(): CouncilAdvisorExtended[] {
    return [...this.state.ritualAdvisors];
  }

  setRitualAdvisors(advisors: CouncilAdvisorExtended[]): void {
    this.state.ritualAdvisors = [...advisors];
  }

  addRitualAdvisor(advisor: CouncilAdvisorExtended): void {
    const exists = this.state.ritualAdvisors.some(a => 
      a.name === advisor.name && a.lens === advisor.lens
    );
    if (!exists) {
      this.state.ritualAdvisors = [...this.state.ritualAdvisors, advisor];
    }
  }

  removeRitualAdvisor(index: number): void {
    this.state.ritualAdvisors = this.state.ritualAdvisors.filter((_, i) => i !== index);
  }

  // Circle advisors
  getCircleAdvisors(): Record<string, string> {
    return { ...this.state.circleAdvisors };
  }

  setCircleAdvisors(advisors: Record<string, string>): void {
    this.state.circleAdvisors = { ...advisors };
  }

  // Glass Bead Game advisors
  getGlassBeadGameAdvisors(): CouncilAdvisorExtended[] {
    return [...this.state.glassBeadGameAdvisors];
  }

  setGlassBeadGameAdvisors(advisors: CouncilAdvisorExtended[]): void {
    this.state.glassBeadGameAdvisors = [...advisors];
  }

  // Previous advisors
  getPreviousAdvisors(): CouncilAdvisorExtended[] {
    return [...this.state.previousAdvisors];
  }

  setPreviousAdvisors(advisors: CouncilAdvisorExtended[]): void {
    this.state.previousAdvisors = [...advisors];
  }

  // Holonic principle: Convert between different advisor representations
  ritualAdvisorsToCircleAdvisors(): Record<string, string> {
    const circleAdvisors: Record<string, string> = {};
    const outerPositions = ['outer-top', 'outer-top-right', 'outer-bottom-right', 'outer-bottom', 'outer-bottom-left', 'outer-top-left'];
    
    this.state.ritualAdvisors.forEach((advisor, index) => {
      if (index < outerPositions.length) {
        circleAdvisors[outerPositions[index]] = advisor.name;
      }
    });
    
    return circleAdvisors;
  }

  circleAdvisorsToRitualAdvisors(): CouncilAdvisorExtended[] {
    const ritualAdvisors: CouncilAdvisorExtended[] = [];
    const outerPositions = ['outer-top', 'outer-top-right', 'outer-bottom-right', 'outer-bottom', 'outer-bottom-left', 'outer-top-left'];
    
    outerPositions.forEach(position => {
      const advisorName = this.state.circleAdvisors[position];
      if (advisorName) {
        const fullAdvisor = resolveAdvisor(advisorName);
        if (fullAdvisor) {
          ritualAdvisors.push(fullAdvisor);
        }
      }
    });
    
    return ritualAdvisors;
  }

  // Debug logging
  logState(context: string): void {
    console.log(`🔍 Advisor State (${context}):`, {
      ritualAdvisors: this.state.ritualAdvisors.map(a => a.name),
      circleAdvisors: this.state.circleAdvisors,
      glassBeadGameAdvisors: this.state.glassBeadGameAdvisors.map(a => a.name),
      previousAdvisors: this.state.previousAdvisors.map(a => a.name)
    });
  }
}

// Singleton instance
export const advisorStateManager = new AdvisorStateManager(); 