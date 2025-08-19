// Italian Quests Generator based on TZM Event @Liminal Village image analysis
// Creates interconnected quests with proper dependencies

export interface Quest {
    id: string;
    title: string;
    description?: string;
    date?: string;
    when?: string;
    status: 'ongoing' | 'completed' | 'recurring' | 'repeating';
    category?: string;
    participants: Array<{ 
        id: string; 
        username: string;
        firstName?: string;
        lastName?: string;
    }>;
    appreciation: string[];
    location?: string;
    ends?: string;
    type?: 'task' | 'quest' | 'event' | 'proposal' | 'recurring';
    orderIndex?: number;
    position?: { x: number; y: number };
    dependsOn?: string[];
    initiator?: {
        id: string;
        username: string;
        firstName?: string;
        lastName?: string;
    };
    created?: string;
    _meta?: {
        resolvedFromHologram?: boolean;
        hologramSoul?: string;
    };
}

function generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function createItalianQuests(holonID: string): Quest[] {
    const currentDateTime = new Date().toISOString();
    
    const defaultInitiator = {
        id: holonID,
        username: "TZM Event Organizer",
        firstName: "TZM",
        lastName: "Organizer"
    };

    // Infrastructure quests (foundational)
    const infrastructure: Quest[] = [
        {
            id: "quest-corrente",
            title: "Abbiamo corrente",
            description: "Ensure we have electrical power supply for the event",
            status: "ongoing",
            category: "Infrastructure",
            type: "quest",
            participants: [],
            appreciation: [],
            dependsOn: [], // No dependencies - foundational
            created: currentDateTime,
            initiator: defaultInitiator,
            orderIndex: 1
        },
        {
            id: "quest-pannelli-solari",
            title: "Abbiamo pannelli solari",
            description: "Set up solar panels for sustainable energy",
            status: "ongoing", 
            category: "Infrastructure",
            type: "quest",
            participants: [],
            appreciation: [],
            dependsOn: [], // Independent infrastructure
            created: currentDateTime,
            initiator: defaultInitiator,
            orderIndex: 2
        },
        {
            id: "quest-acqua-corrente",
            title: "L'acqua corrente",
            description: "Establish running water supply",
            status: "ongoing",
            category: "Infrastructure", 
            type: "quest",
            participants: [],
            appreciation: [],
            dependsOn: [], // Foundational
            created: currentDateTime,
            initiator: defaultInitiator,
            orderIndex: 3
        },
        {
            id: "quest-generator",
            title: "Abbiamo generatore",
            description: "Set up backup power generator",
            status: "ongoing",
            category: "Infrastructure",
            type: "quest", 
            participants: [],
            appreciation: [],
            dependsOn: ["quest-corrente"], // Backup to main power
            created: currentDateTime,
            initiator: defaultInitiator,
            orderIndex: 4
        }
    ];

    // Facilities quests (depend on infrastructure)
    const facilities: Quest[] = [
        {
            id: "quest-bagni",
            title: "Abbiamo bagni",
            description: "Set up bathroom facilities",
            status: "ongoing",
            category: "Facilities",
            type: "quest",
            participants: [],
            appreciation: [],
            dependsOn: ["quest-acqua-corrente"], // Need water for bathrooms
            created: currentDateTime,
            initiator: defaultInitiator,
            orderIndex: 5
        },
        {
            id: "quest-docce",
            title: "Abbiamo docce",
            description: "Install shower facilities",
            status: "ongoing",
            category: "Facilities", 
            type: "quest",
            participants: [],
            appreciation: [],
            dependsOn: ["quest-acqua-corrente", "quest-bagni"], // Need water and bathroom infrastructure
            created: currentDateTime,
            initiator: defaultInitiator,
            orderIndex: 6
        },
        {
            id: "quest-frigo",
            title: "Abbiamo frigo",
            description: "Set up refrigeration for food storage",
            status: "ongoing",
            category: "Facilities",
            type: "quest",
            participants: [],
            appreciation: [],
            dependsOn: ["quest-corrente"], // Need electricity for fridge
            created: currentDateTime,
            initiator: defaultInitiator,
            orderIndex: 7
        },
        {
            id: "quest-tavolo",
            title: "Abbiamo 1 tavolo",
            description: "Set up table for food preparation and dining",
            status: "ongoing",
            category: "Facilities",
            type: "quest",
            participants: [],
            appreciation: [],
            dependsOn: [], // Basic furniture - no dependencies
            created: currentDateTime,
            initiator: defaultInitiator,
            orderIndex: 8
        },
        {
            id: "quest-bacinelle",
            title: "Abbiamo bacinelle",
            description: "Set up basins for washing and food preparation",
            status: "ongoing",
            category: "Facilities",
            type: "quest",
            participants: [],
            appreciation: [],
            dependsOn: ["quest-acqua-corrente"], // Need water for basins to be useful
            created: currentDateTime,
            initiator: defaultInitiator,
            orderIndex: 9
        }
    ];

    // Storage quests (depend on facilities)
    const storage: Quest[] = [
        {
            id: "quest-dispensa",
            title: "Abbiamo dispensa",
            description: "Set up dry goods pantry storage",
            status: "ongoing",
            category: "Storage",
            type: "quest",
            participants: [],
            appreciation: [],
            dependsOn: [], // Basic storage - no dependencies
            created: currentDateTime,
            initiator: defaultInitiator,
            orderIndex: 10
        },
        {
            id: "quest-cambusa",
            title: "Abbiamo cambusa",
            description: "Set up main food storage area",
            status: "ongoing",
            category: "Storage",
            type: "quest",
            participants: [],
            appreciation: [],
            dependsOn: ["quest-dispensa", "quest-frigo"], // Need both dry and cold storage
            created: currentDateTime,
            initiator: defaultInitiator,
            orderIndex: 11
        }
    ];

    // Food procurement quests (depend on storage being ready)
    const foodProcurement: Quest[] = [
        {
            id: "quest-portato-carni",
            title: "Abbiamo portato carni",
            description: "Bring meat supplies for the event",
            status: "ongoing",
            category: "Food Procurement",
            type: "quest",
            participants: [],
            appreciation: [],
            dependsOn: ["quest-frigo"], // Need refrigeration for meat
            created: currentDateTime,
            initiator: defaultInitiator,
            orderIndex: 12
        },
        {
            id: "quest-portato-cereali",
            title: "Abbiamo portato cereali",
            description: "Bring cereal and grain supplies",
            status: "ongoing",
            category: "Food Procurement",
            type: "quest",
            participants: [],
            appreciation: [],
            dependsOn: ["quest-dispensa"], // Need dry storage for cereals
            created: currentDateTime,
            initiator: defaultInitiator,
            orderIndex: 13
        },
        {
            id: "quest-portato-farine",
            title: "Abbiamo portato farine",
            description: "Bring flour for baking and cooking",
            status: "ongoing",
            category: "Food Procurement",
            type: "quest",
            participants: [],
            appreciation: [],
            dependsOn: ["quest-dispensa"], // Need dry storage for flour
            created: currentDateTime,
            initiator: defaultInitiator,
            orderIndex: 14
        },
        {
            id: "quest-portato-legumi",
            title: "Abbiamo portato legumi",
            description: "Bring legumes and beans",
            status: "ongoing",
            category: "Food Procurement",
            type: "quest",
            participants: [],
            appreciation: [],
            dependsOn: ["quest-dispensa"], // Need dry storage for legumes
            created: currentDateTime,
            initiator: defaultInitiator,
            orderIndex: 15
        },
        {
            id: "quest-portato-verdura",
            title: "Abbiamo portato verdura",
            description: "Bring fresh vegetables",
            status: "ongoing",
            category: "Food Procurement",
            type: "quest",
            participants: [],
            appreciation: [],
            dependsOn: ["quest-frigo"], // Need refrigeration for fresh vegetables
            created: currentDateTime,
            initiator: defaultInitiator,
            orderIndex: 16
        },
        {
            id: "quest-portato-formaggi",
            title: "Abbiamo portato formaggi",
            description: "Bring cheese supplies",
            status: "ongoing",
            category: "Food Procurement",
            type: "quest",
            participants: [],
            appreciation: [],
            dependsOn: ["quest-frigo"], // Need refrigeration for cheese
            created: currentDateTime,
            initiator: defaultInitiator,
            orderIndex: 17
        }
    ];

    // Beverage procurement quests
    const beverageProcurement: Quest[] = [
        {
            id: "quest-portato-bevande",
            title: "Abbiamo portato bevande",
            description: "Bring general beverages",
            status: "ongoing",
            category: "Beverage Procurement",
            type: "quest",
            participants: [],
            appreciation: [],
            dependsOn: ["quest-dispensa"], // Basic storage for beverages
            created: currentDateTime,
            initiator: defaultInitiator,
            orderIndex: 18
        },
        {
            id: "quest-portato-vino",
            title: "Abbiamo portato vino",
            description: "Bring wine for the event",
            status: "ongoing",
            category: "Beverage Procurement",
            type: "quest",
            participants: [],
            appreciation: [],
            dependsOn: ["quest-dispensa"], // Storage for wine
            created: currentDateTime,
            initiator: defaultInitiator,
            orderIndex: 19
        },
        {
            id: "quest-portato-birra",
            title: "Abbiamo portato birra",
            description: "Bring beer for the event",
            status: "ongoing",
            category: "Beverage Procurement",
            type: "quest",
            participants: [],
            appreciation: [],
            dependsOn: ["quest-frigo"], // Cold storage preferred for beer
            created: currentDateTime,
            initiator: defaultInitiator,
            orderIndex: 20
        }
    ];

    // Final preparation quest (depends on all food being ready)
    const finalPreparation: Quest[] = [
        {
            id: "quest-cibo-ready",
            title: "Abbiamo cibo",
            description: "All food supplies are ready and organized for the TZM event",
            status: "ongoing",
            category: "Final Preparation",
            type: "quest",
            participants: [],
            appreciation: [],
            dependsOn: [
                "quest-portato-carni",
                "quest-portato-cereali", 
                "quest-portato-farine",
                "quest-portato-legumi",
                "quest-portato-verdura",
                "quest-portato-formaggi",
                "quest-portato-bevande",
                "quest-portato-vino",
                "quest-portato-birra",
                "quest-tavolo",
                "quest-bacinelle"
            ], // All food and prep facilities must be ready
            created: currentDateTime,
            initiator: defaultInitiator,
            orderIndex: 21
        }
    ];

    // Combine all quests
    return [
        ...infrastructure,
        ...facilities, 
        ...storage,
        ...foodProcurement,
        ...beverageProcurement,
        ...finalPreparation
    ];
}

// Utility function to add quests to holosphere
export async function addItalianQuestsToHolosphere(holosphere: any, holonID: string): Promise<void> {
    const quests = createItalianQuests(holonID);
    
    try {
        for (const quest of quests) {
            await holosphere.put(holonID, 'quests', quest);
            console.log(`Added quest: ${quest.title}`);
        }
        console.log(`Successfully added ${quests.length} Italian quests with dependencies`);
    } catch (error) {
        console.error('Error adding Italian quests:', error);
        throw error;
    }
}
