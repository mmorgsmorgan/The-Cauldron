// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./AIRitualNFT.sol";

/**
 * @title NFTFactory
 * @notice Deploys AIRitualNFT collections as minimal proxy (EIP-1167) clones.
 *         Tracks all collections and provides owner-based lookups.
 */
contract NFTFactory is Ownable {
    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────
    address public implementation;
    address[] public allCollections;
    mapping(address => address[]) public collectionsByOwner;
    mapping(address => bool) public isOfficialCollection;
    uint256 private _nonce;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────
    event CollectionCreated(
        address indexed owner,
        address indexed collection,
        string name,
        string symbol,
        uint256 maxSupply,
        uint256 timestamp
    );

    event ImplementationUpdated(address indexed oldImpl, address indexed newImpl);

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────
    constructor(address implementation_) Ownable(msg.sender) {
        implementation = implementation_;
    }

    // ──────────────────────────────────────────────
    //  Factory
    // ──────────────────────────────────────────────

    /**
     * @notice Deploy a new NFT collection as a minimal proxy clone.
     * @param name_ Collection name
     * @param symbol_ Collection symbol
     * @param baseURI_ Base metadata URI (IPFS)
     * @param maxSupply_ Maximum token supply
     * @param royaltyReceiver_ Address to receive royalty payments
     * @param royaltyFee_ Royalty fee in basis points (max 1000 = 10%)
     * @param phases_ Array of mint phases to configure
     * @return clone Address of the deployed collection
     */
    function createCollection(
        string calldata name_,
        string calldata symbol_,
        string calldata baseURI_,
        uint256 maxSupply_,
        address royaltyReceiver_,
        uint96 royaltyFee_,
        AIRitualNFT.MintPhase[] calldata phases_
    ) external returns (address clone) {
        // Deterministic salt from sender + nonce
        bytes32 salt = keccak256(abi.encode(msg.sender, _nonce++));
        clone = Clones.cloneDeterministic(implementation, salt);

        // Initialize the clone
        AIRitualNFT(clone).initialize(
            name_,
            symbol_,
            baseURI_,
            maxSupply_,
            royaltyReceiver_,
            royaltyFee_,
            msg.sender,
            phases_
        );

        // Track
        allCollections.push(clone);
        collectionsByOwner[msg.sender].push(clone);
        isOfficialCollection[clone] = true;

        emit CollectionCreated(
            msg.sender,
            clone,
            name_,
            symbol_,
            maxSupply_,
            block.timestamp
        );
    }

    // ──────────────────────────────────────────────
    //  Views
    // ──────────────────────────────────────────────

    function getCollectionsByOwner(address owner) external view returns (address[] memory) {
        return collectionsByOwner[owner];
    }

    function getAllCollections() external view returns (address[] memory) {
        return allCollections;
    }

    function totalCollections() external view returns (uint256) {
        return allCollections.length;
    }

    /**
     * @notice Predict the address of the next clone for a given deployer.
     */
    function predictAddress(address deployer) external view returns (address) {
        bytes32 salt = keccak256(abi.encode(deployer, _nonce));
        return Clones.predictDeterministicAddress(implementation, salt);
    }

    // ──────────────────────────────────────────────
    //  Admin
    // ──────────────────────────────────────────────

    function setImplementation(address newImpl) external onlyOwner {
        emit ImplementationUpdated(implementation, newImpl);
        implementation = newImpl;
    }
}
