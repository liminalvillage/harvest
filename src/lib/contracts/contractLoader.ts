// Contract loader with static deployment addresses and mock ABIs for development
import { browser } from '$app/environment';

// Network detection - safe for browser environment
function getNetworkName(): string {
  // In browser, use import.meta.env instead of process.env
  if (typeof window !== 'undefined') {
    return (import.meta.env?.VITE_NETWORK_NAME as string) || 'localhost';
  }
  // On server, use process.env if available
  return (typeof process !== 'undefined' ? process.env?.VITE_NETWORK_NAME : undefined) || 'localhost';
}

// Available holon types
export const HOLON_TYPES = ['Managed', 'Zoned', 'Splitter', 'Appreciative'] as const;
export type HolonType = typeof HOLON_TYPES[number];

// Development mode detection - safe for browser environment
export const isDevelopmentMode = () => {
  const networkName = getNetworkName();
  return !networkName || networkName === 'localhost';
};

// Static deployment addresses from the contracts/deployment.json
const DEPLOYMENT_ADDRESSES = {
  localhost: {
    "ManagedFactory": "0x970BEdBc63360f45722fc745D652002ED4e13402",
    "ZonedFactory": "0xe0cCCCf322adFEDba141e41c2E3196165EeE5bB7",
    "SplitterFactory": "0x414e49fE684f3561deF89740c642e6C6c380246E",
    "AppreciativeFactory": "0x09254D834049de367305E429855b2CfD0E0A00ad",
    "Holons": "0x6b31F3b8da4Dfe7b4AB0e37287D3856f17130343",
    "Managed": "0xEfE3Ade7c6836F2613ae646C7c836131AE47281c",
    "Zoned": "0x795d745FbAB949cCC1a5E30DA9376d9a65510971",
    "Splitter": "0x0E81302DE110990cC3Fdd2a8ECb5bf8302d8b0e9",
    "TestToken": "0xd70229C297DB9C900fF797621Aa58C6EacdBb23b"
  },
  homestead: {
    "SplitterFactory": "0xB426156a15601C0103910E9c731Bb3615C2CFC92",
    "AppreciativeFactory": "0x264c8344A60d0687c0312abF0187F582Ed225854",
    "ZonedFactory": "0x44bB2aBcd848DeC740F3853f33303a2257b70b33",
    "ManagedFactory": "0xEd8A6280C0684A5d2B939E1ac440f52957489D7B",
    "Managed": "0x335D0d9bc5C5e03E1DCd3575509a03034A2f12F7",
    "Holons": "0x3fE6F808E4bA48ACD56b88EF1DA1de11e330186e",
    "TestToken": "0xeAD87f57830089eB963930765B0AD48699Ffe30a"
  },
  gnosis: {
    "SplitterFactory": "0x8F29D63161356cd3C4276ABADfe37329597a05F0",
    "AppreciativeFactory": "0x7cca01Ad06b09a5c6455D530060b2BE26c147f5C",
    "ZonedFactory": "0x60cAea42439028A762Cce8D03A315Ec68686E457",
    "ManagedFactory": "0x9a9499eB4caf6483669Bb757B6452338F6985a4e",
    "Managed": "0x7B71b9378abeAD38A60ef8Aea1C6c4Dd67A04e21",
    "Holons": "0x49E9D0701e53C9158bD629E6F68A62FC034ACAb3",
    "Zoned": "0x84564845f4f184B704F26c8d7286A7713ce3a19D",
    "Splitter": "0xD66B44FAFAb1f468CBE8Ad208B44d922A7aCD6ee",
    "TestToken": "0x22DCdee672A7DFC42B5E0b06AFA4bA26D2Ec3A80"
  },
  sepolia: {
    "ManagedFactory": "0xD2782eeb75b328AFB0Eb4e5880Bd8cD234F5bb0f",
    "ZonedFactory": "0x03d676d793eE5b4938dBe2a09413365fA630F4Fa",
    "SplitterFactory": "0x61e2d0cbf0eB6042904ECb435DeE07b53B767CC0",
    "AppreciativeFactory": "0x4E9787981705C5dF9C3b039D11E065E7d697e6B8",
    "Holons": "0xC1DFAe18B21b22EfE959b98284e4D3B2aE100322",
    "Managed": "0xCaD6d4F7CE0bF31f8FFA760af3F0E28Ba0Df0CD3",
    "Zoned": "0x450F33e5F90ceD0864B7af53c865F5d673b9E8C8",
    "Splitter": "0xf6e07d605882f1DC2015ff3C84EFa12c58860754",
    "TestToken": "0xf11DA4F41899c5E6437cE32061F27C4580A6586F"
  }
};

// Basic contract ABIs for essential functions
const CONTRACT_ABIS = {
  Splitter: [
    {
      "inputs": [{"name": "internalPercent", "type": "uint256"}],
      "name": "updateSplit",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getInternalPercent", 
      "outputs": [{"name": "", "type": "uint256"}],
      "stateMutability": "view",
      "type": "function"
    }
  ],
  Managed: [
    {
      "inputs": [{"name": "members", "type": "address[]"}],
      "name": "addMembers",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getMembers",
      "outputs": [{"name": "", "type": "address[]"}],
      "stateMutability": "view",
      "type": "function"
    }
  ],
  Zoned: [
    {
      "inputs": [],
      "name": "getZones",
      "outputs": [{"name": "", "type": "string[]"}],
      "stateMutability": "view",
      "type": "function"
    }
  ],
  Holons: [
    {
      "inputs": [],
      "name": "listFlavors",
      "outputs": [{"name": "", "type": "string[]"}],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [{"name": "", "type": "string"}],
      "name": "toAddress",
      "outputs": [{"name": "", "type": "address"}],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "listHolons",
      "outputs": [{"name": "", "type": "address[]"}],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [{"name": "_address", "type": "address"}],
      "name": "listHolonsOf",
      "outputs": [{"name": "", "type": "address[]"}],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {"name": "_creatorUserId", "type": "string"},
        {"name": "_name", "type": "string"},
        {"name": "_parameter", "type": "uint256"}
      ],
      "name": "newHolonBundle",
      "outputs": [{"name": "", "type": "address"}],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ],
  SplitterFactory: [],
  ManagedFactory: [],
  ZonedFactory: [],
  AppreciativeFactory: []
};

// Get deployment addresses for current network
export function getDeploymentAddresses() {
  const network = getNetworkName();
  return DEPLOYMENT_ADDRESSES[network as keyof typeof DEPLOYMENT_ADDRESSES] || DEPLOYMENT_ADDRESSES.localhost;
}

// Async functions that return the same data for backward compatibility
export async function loadContractABIs() {
  console.log('Loading contract ABIs (using static data)...');
  return CONTRACT_ABIS;
}

export async function loadDeploymentAddresses() {
  const addresses = getDeploymentAddresses();
  console.log('Contract deployment addresses loaded:', {
    network: getNetworkName(),
    addresses,
    isDevelopment: isDevelopmentMode()
  });
  return addresses;
}

// Synchronous exports
export { CONTRACT_ABIS };
export const CONTRACT_ADDRESSES = getDeploymentAddresses();