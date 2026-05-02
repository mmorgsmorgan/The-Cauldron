// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "erc721a/contracts/ERC721A.sol";
import "erc721a/contracts/extensions/ERC721AQueryable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title AIRitualNFT
 * @notice Individual NFT collection contract deployed via NFTFactory.
 *         Supports multi-phase minting (GTD allowlist + public),
 *         ERC-2981 royalties, and ERC-721A gas-efficient batch minting.
 *         Includes ERC721AQueryable for tokensOfOwner enumeration.
 */
contract AIRitualNFT is ERC721AQueryable, ERC2981, Ownable, ReentrancyGuard {
    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────
    error MaxSupplyExceeded();
    error PhaseNotActive();
    error PhaseNotPublic();
    error InvalidProof();
    error WalletLimitExceeded();
    error InsufficientPayment();
    error WithdrawFailed();
    error RoyaltyTooHigh();
    error InvalidPhaseId();
    error ZeroQuantity();

    // ──────────────────────────────────────────────
    //  Structs
    // ──────────────────────────────────────────────
    struct MintPhase {
        uint64 startTime;
        uint64 endTime;
        uint128 price;
        uint32 maxPerWallet;
        bytes32 merkleRoot;
        bool isPublic;
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────
    string private _baseTokenURI;
    uint256 public maxSupply;
    MintPhase[] public phases;
    bool public initialized;

    // Clone-safe name/symbol storage (ERC721A's _name/_symbol are private
    // and only set in the constructor which never runs for proxy clones)
    string private _collectionName;
    string private _collectionSymbol;

    /// @dev phaseId => wallet => minted count
    mapping(uint256 => mapping(address => uint256)) public mintedPerWalletPerPhase;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────
    event PhaseAdded(uint256 indexed phaseId, bool isPublic, uint128 price);
    event PhaseUpdated(uint256 indexed phaseId);
    event Minted(address indexed to, uint256 indexed phaseId, uint256 quantity, uint256 firstTokenId);
    event BaseURIUpdated(string newBaseURI);

    // ──────────────────────────────────────────────
    //  Constructor (used as implementation template)
    // ──────────────────────────────────────────────
    constructor() ERC721A("RitualNFT", "RNFT") Ownable(msg.sender) {
        // Implementation contract — not used directly
    }

    /**
     * @notice Initializer called by the factory after cloning.
     * @dev Can only be called once. Replaces constructor for clones.
     */
    function initialize(
        string calldata name_,
        string calldata symbol_,
        string calldata baseURI_,
        uint256 maxSupply_,
        address royaltyReceiver_,
        uint96 royaltyFee_,
        address owner_,
        MintPhase[] calldata phases_
    ) external {
        require(!initialized, "Already initialized");
        if (royaltyFee_ > 1000) revert RoyaltyTooHigh(); // max 10%

        initialized = true;

        // ERC721A proxy fix: constructor never runs for clones, so _currentIndex
        // stays 0 causing underflow in _totalMinted(). Initialize it here.
        _initCurrentIndex();

        // Store name/symbol in clone-safe storage (ERC721A's are private)
        _collectionName = name_;
        _collectionSymbol = symbol_;

        _baseTokenURI = baseURI_;
        maxSupply = maxSupply_;

        _setDefaultRoyalty(royaltyReceiver_, royaltyFee_);
        _transferOwnership(owner_);

        for (uint256 i = 0; i < phases_.length; i++) {
            phases.push(phases_[i]);
            emit PhaseAdded(i, phases_[i].isPublic, phases_[i].price);
        }
    }

    /// @dev ERC721A v4 uses regular storage. _currentIndex is the first declared
    ///      variable in ERC721A (most-base contract) → slot 0.
    ///      Proxy clones skip the constructor so we set it manually to _startTokenId()=1.
    function _initCurrentIndex() private {
        assembly {
            sstore(0, 1)
        }
    }


    // ──────────────────────────────────────────────
    //  Minting
    // ──────────────────────────────────────────────

    /**
     * @notice Allowlist mint using a Merkle proof.
     * @param phaseId The index of the mint phase
     * @param quantity Number of tokens to mint
     * @param proof Merkle proof for the caller's address
     */
    function allowlistMint(
        uint256 phaseId,
        uint256 quantity,
        bytes32[] calldata proof
    ) external payable nonReentrant {
        if (quantity == 0) revert ZeroQuantity();
        if (phaseId >= phases.length) revert InvalidPhaseId();

        MintPhase storage phase = phases[phaseId];
        if (phase.isPublic) revert PhaseNotActive();
        if (block.timestamp < phase.startTime || block.timestamp > phase.endTime)
            revert PhaseNotActive();
        if (_totalMinted() + quantity > maxSupply) revert MaxSupplyExceeded();
        if (msg.value < uint256(phase.price) * quantity) revert InsufficientPayment();

        // Verify wallet limit
        uint256 minted = mintedPerWalletPerPhase[phaseId][msg.sender];
        if (minted + quantity > phase.maxPerWallet) revert WalletLimitExceeded();

        // Verify Merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        if (!MerkleProof.verify(proof, phase.merkleRoot, leaf)) revert InvalidProof();

        mintedPerWalletPerPhase[phaseId][msg.sender] = minted + quantity;
        uint256 startId = _nextTokenId();
        _mint(msg.sender, quantity);

        emit Minted(msg.sender, phaseId, quantity, startId);
    }

    /**
     * @notice Public mint (no proof required).
     * @param phaseId The index of the mint phase
     * @param quantity Number of tokens to mint
     */
    function publicMint(
        uint256 phaseId,
        uint256 quantity
    ) external payable nonReentrant {
        if (quantity == 0) revert ZeroQuantity();
        if (phaseId >= phases.length) revert InvalidPhaseId();

        MintPhase storage phase = phases[phaseId];
        if (!phase.isPublic) revert PhaseNotPublic();
        if (block.timestamp < phase.startTime || block.timestamp > phase.endTime)
            revert PhaseNotActive();
        if (_totalMinted() + quantity > maxSupply) revert MaxSupplyExceeded();
        if (msg.value < uint256(phase.price) * quantity) revert InsufficientPayment();

        uint256 minted = mintedPerWalletPerPhase[phaseId][msg.sender];
        if (minted + quantity > phase.maxPerWallet) revert WalletLimitExceeded();

        mintedPerWalletPerPhase[phaseId][msg.sender] = minted + quantity;
        uint256 startId = _nextTokenId();
        _mint(msg.sender, quantity);

        emit Minted(msg.sender, phaseId, quantity, startId);
    }

    /**
     * @notice Owner-only mint for airdrops or reserves.
     * @param to Recipient address
     * @param quantity Number of tokens to mint
     */
    function ownerMint(address to, uint256 quantity) external onlyOwner {
        if (_totalMinted() + quantity > maxSupply) revert MaxSupplyExceeded();
        _mint(to, quantity);
        emit Minted(to, type(uint256).max, quantity, _nextTokenId() - quantity);
    }

    // ──────────────────────────────────────────────
    //  Admin
    // ──────────────────────────────────────────────

    function setMerkleRoot(uint256 phaseId, bytes32 root) external onlyOwner {
        if (phaseId >= phases.length) revert InvalidPhaseId();
        phases[phaseId].merkleRoot = root;
        emit PhaseUpdated(phaseId);
    }

    function setPhaseTime(uint256 phaseId, uint64 start, uint64 end) external onlyOwner {
        if (phaseId >= phases.length) revert InvalidPhaseId();
        phases[phaseId].startTime = start;
        phases[phaseId].endTime = end;
        emit PhaseUpdated(phaseId);
    }

    function addPhase(MintPhase calldata phase) external onlyOwner {
        phases.push(phase);
        emit PhaseAdded(phases.length - 1, phase.isPublic, phase.price);
    }

    function setBaseURI(string calldata baseURI_) external onlyOwner {
        _baseTokenURI = baseURI_;
        emit BaseURIUpdated(baseURI_);
    }

    function setRoyalty(address receiver, uint96 fee) external onlyOwner {
        if (fee > 1000) revert RoyaltyTooHigh();
        _setDefaultRoyalty(receiver, fee);
    }

    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(owner()).call{value: balance}("");
        if (!success) revert WithdrawFailed();
    }

    // ──────────────────────────────────────────────
    //  View
    // ──────────────────────────────────────────────

    function totalPhases() external view returns (uint256) {
        return phases.length;
    }

    function getPhase(uint256 phaseId) external view returns (MintPhase memory) {
        return phases[phaseId];
    }

    function totalMinted() external view returns (uint256) {
        return _totalMinted();
    }

    function baseURI() external view returns (string memory) {
        return _baseTokenURI;
    }

    // ──────────────────────────────────────────────
    //  Overrides
    // ──────────────────────────────────────────────

    /// @dev Override name() to return clone-safe name (falls back to ERC721A's if not set)
    function name() public view override(ERC721A, IERC721A) returns (string memory) {
        if (bytes(_collectionName).length > 0) return _collectionName;
        return super.name();
    }

    /// @dev Override symbol() to return clone-safe symbol
    function symbol() public view override(ERC721A, IERC721A) returns (string memory) {
        if (bytes(_collectionSymbol).length > 0) return _collectionSymbol;
        return super.symbol();
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function _startTokenId() internal pure override returns (uint256) {
        return 1;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721A, IERC721A, ERC2981)
        returns (bool)
    {
        return ERC721A.supportsInterface(interfaceId) || ERC2981.supportsInterface(interfaceId);
    }
}
