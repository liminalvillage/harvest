// Test file for holonic LLM functionality
// Run this to test the context building before we integrate

import { testHolonicContextBuilder, createTestQuestTree, getGenerationWisdom } from './holonicLLM';

// Test 1: Context Builder
console.log('🧪 Testing Holonic Context Builder:');
const hierarchy = testHolonicContextBuilder();
console.log(JSON.stringify(hierarchy, null, 2));

// Test 2: Generation Wisdom
console.log('\n🧪 Testing Generation Wisdom:');
for (let gen = 1; gen <= 6; gen++) {
  const wisdom = getGenerationWisdom(gen);
  console.log(`Gen ${gen}: ${wisdom.guidance}`);
  console.log(`Examples: ${wisdom.examples}`);
  console.log(`Level: ${wisdom.actionabilityLevel}\n`);
}

// Test 3: Quest Tree Structure
console.log('🧪 Testing Quest Tree Structure:');
const testTree = createTestQuestTree();
console.log(`Tree has ${Object.keys(testTree.nodes).length} nodes`);
console.log(`Max generations: ${testTree.maxGenerations}`);
console.log(`Root nodes: ${testTree.rootNodeIds.length}`);

// Export for external testing
export { testHolonicContextBuilder, createTestQuestTree, getGenerationWisdom };
