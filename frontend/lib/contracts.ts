const DEFAULT_FACTORY = "0xCeD6f5eA4b8e9D448fF732Ef44267D6cbD9F750f" as const;
const DEFAULT_MARKETPLACE = "0x9cDB207D834c1c5FE3b1777fC360eC4473f5A38B" as const;

export const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS || DEFAULT_FACTORY) as `0x${string}`;
export const MARKETPLACE_ADDRESS = (process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS || DEFAULT_MARKETPLACE) as `0x${string}`;

// ── AIRitualNFT ABI (key functions) ──
export const AIRitualNFT_ABI = [
  {
    inputs: [{ name: "phaseId", type: "uint256" }, { name: "quantity", type: "uint256" }, { name: "proof", type: "bytes32[]" }],
    name: "allowlistMint",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "phaseId", type: "uint256" }, { name: "quantity", type: "uint256" }],
    name: "publicMint",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "to", type: "address" }, { name: "quantity", type: "uint256" }],
    name: "ownerMint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "maxSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalMinted",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalPhases",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "phaseId", type: "uint256" }],
    name: "getPhase",
    outputs: [{
      components: [
        { name: "startTime", type: "uint64" },
        { name: "endTime", type: "uint64" },
        { name: "price", type: "uint128" },
        { name: "maxPerWallet", type: "uint32" },
        { name: "merkleRoot", type: "bytes32" },
        { name: "isPublic", type: "bool" },
      ],
      name: "",
      type: "tuple",
    }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "phaseId", type: "uint256" }, { name: "root", type: "bytes32" }],
    name: "setMerkleRoot",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "operator", type: "address" }, { name: "approved", type: "bool" }],
    name: "setApprovalForAll",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }, { name: "salePrice", type: "uint256" }],
    name: "royaltyInfo",
    outputs: [{ name: "receiver", type: "address" }, { name: "royaltyAmount", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "phaseId", type: "uint256" }, { name: "wallet", type: "address" }],
    name: "mintedPerWalletPerPhase",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ── NFTFactory ABI ──
export const NFTFactory_ABI = [
  {
    inputs: [
      { name: "name_", type: "string" },
      { name: "symbol_", type: "string" },
      { name: "baseURI_", type: "string" },
      { name: "maxSupply_", type: "uint256" },
      { name: "royaltyReceiver_", type: "address" },
      { name: "royaltyFee_", type: "uint96" },
      {
        name: "phases_",
        type: "tuple[]",
        components: [
          { name: "startTime", type: "uint64" },
          { name: "endTime", type: "uint64" },
          { name: "price", type: "uint128" },
          { name: "maxPerWallet", type: "uint32" },
          { name: "merkleRoot", type: "bytes32" },
          { name: "isPublic", type: "bool" },
        ],
      },
    ],
    name: "createCollection",
    outputs: [{ name: "clone", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "getCollectionsByOwner",
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getAllCollections",
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalCollections",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ── RitualMarketplace ABI ──
export const RitualMarketplace_ABI = [
  {
    inputs: [{ name: "nftContract", type: "address" }, { name: "tokenId", type: "uint256" }, { name: "price", type: "uint256" }],
    name: "list",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "nftContract", type: "address" }, { name: "tokenId", type: "uint256" }],
    name: "buy",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "nftContract", type: "address" }, { name: "tokenId", type: "uint256" }],
    name: "cancelListing",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "nftContract", type: "address" }, { name: "tokenId", type: "uint256" }],
    name: "getListing",
    outputs: [{
      components: [
        { name: "seller", type: "address" },
        { name: "nftContract", type: "address" },
        { name: "tokenId", type: "uint256" },
        { name: "price", type: "uint256" },
        { name: "active", type: "bool" },
      ],
      name: "",
      type: "tuple",
    }],
    stateMutability: "view",
    type: "function",
  },
] as const;
