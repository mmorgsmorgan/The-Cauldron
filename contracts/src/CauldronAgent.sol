// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

// ── Interfaces ──────────────────────────────────────────────────────────────

interface IRitualMarketplace {
    struct Listing {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 price;
        bool active;
    }
    function list(address nftContract, uint256 tokenId, uint256 price) external;
    function buy(address nftContract, uint256 tokenId) external payable;
    function cancelListing(address nftContract, uint256 tokenId) external;
    function getListing(address nftContract, uint256 tokenId) external view returns (Listing memory);
}

interface INFTFactory {
    function getAllCollections() external view returns (address[] memory);
}

// ── CauldronAgent ────────────────────────────────────────────────────────────

/**
 * @title CauldronAgent
 * @notice Autonomous on-chain agent for The Cauldron NFT marketplace on Ritual Chain.
 *         Uses the Sovereign Agent precompile (0x080C) for AI-driven decision making.
 *         Executes buy / list / cancel actions within operator-defined policy limits.
 *
 * @dev Architecture:
 *   1. Operator funds agent with RITUAL and sets policy
 *   2. Anyone (or a scheduler) calls requestDecision() with market context
 *   3. Sovereign Agent precompile processes the prompt off-chain in a TEE
 *   4. AsyncDelivery calls back executeDecision() with the AI result
 *   5. Agent parses action and executes within policy bounds
 *
 *   Agent identity: This contract ALWAYS identifies itself as an autonomous agent.
 *   It never conceals its on-chain nature. All actions are fully auditable on-chain.
 */
contract CauldronAgent is Ownable, ReentrancyGuard, IERC721Receiver {

    // ── Ritual System Addresses ──────────────────────────────────────────────

    /// @dev Sovereign Agent precompile - submits AI reasoning jobs
    address public constant SOVEREIGN_AGENT = 0x000000000000000000000000000000000000080C;

    /// @dev AsyncDelivery - the only valid caller for executeDecision callbacks
    address public constant ASYNC_DELIVERY = 0x5A16214fF555848411544b005f7Ac063742f39F6;

    // ── Cauldron Contract Addresses ──────────────────────────────────────────

    address public marketplace;
    address public factory;

    // ── Agent Policy ─────────────────────────────────────────────────────────

    enum Mode { SUPERVISED, AUTONOMOUS, DRY_RUN }

    struct Policy {
        Mode    mode;             // Execution mode
        uint256 spendCeiling;     // Max RITUAL per single buy action (wei)
        uint256 maxListPrice;     // Max price to list an NFT at (wei)
        bool    allowBuy;         // Can the agent buy NFTs?
        bool    allowList;        // Can the agent list NFTs?
        bool    allowCancel;      // Can the agent cancel listings?
        uint8   minConfidence;    // Min AI confidence (0-100) before executing
    }

    Policy public policy;

    // ── Pending Actions (supervisor approval queue) ───────────────────────────

    enum ActionType { NONE, BUY, LIST, CANCEL }

    struct PendingAction {
        ActionType  actionType;
        address     nftContract;
        uint256     tokenId;
        uint256     value;        // price for BUY, listing price for LIST
        uint8       confidence;
        uint256     timestamp;
        bool        approved;
        bool        executed;
    }

    mapping(bytes32 => PendingAction) public pendingActions;
    bytes32[] public pendingQueue;

    // ── State ────────────────────────────────────────────────────────────────

    /// @dev Tracks which task IDs are pending async responses
    mapping(bytes32 => bool) public pendingTasks;

    /// @dev Tracks total RITUAL spent by this agent
    uint256 public totalSpent;

    /// @dev Total actions executed
    uint256 public actionsExecuted;

    // ── Events ───────────────────────────────────────────────────────────────

    event AgentIdentity(string message);
    event DecisionRequested(bytes32 indexed taskId, string prompt);
    event DecisionReceived(bytes32 indexed taskId, string result);
    event ActionQueued(bytes32 indexed actionId, ActionType actionType, address nftContract, uint256 tokenId, uint256 value, uint8 confidence);
    event ActionApproved(bytes32 indexed actionId);
    event ActionRejected(bytes32 indexed actionId, string reason);
    event ActionExecuted(bytes32 indexed actionId, ActionType actionType, address nftContract, uint256 tokenId);
    event PolicyUpdated(Mode mode, uint256 spendCeiling, bool allowBuy, bool allowList, bool allowCancel);
    event FundsDeposited(address indexed from, uint256 amount);
    event FundsWithdrawn(address indexed to, uint256 amount);

    // ── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyAsyncDelivery() {
        require(msg.sender == ASYNC_DELIVERY, "CauldronAgent: only AsyncDelivery");
        _;
    }

    /// @notice ERC721Receiver - allows this contract to receive NFTs from buy()
    function onERC721Received(
        address, address, uint256, bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    // ── Constructor ──────────────────────────────────────────────────────────

    /**
     * @param _marketplace  RitualMarketplace contract address
     * @param _factory      NFTFactory contract address
     * @param _spendCeiling Max RITUAL per buy action (in wei)
     */
    constructor(
        address _marketplace,
        address _factory,
        uint256 _spendCeiling
    ) Ownable(msg.sender) {
        marketplace = _marketplace;
        factory     = _factory;

        // Default policy: supervised mode, conservative limits
        policy = Policy({
            mode:          Mode.SUPERVISED,
            spendCeiling:  _spendCeiling,
            maxListPrice:  100 ether,
            allowBuy:      true,
            allowList:     true,
            allowCancel:   true,
            minConfidence: 70
        });

        emit AgentIdentity(
            "CauldronAgent v1.0: I am an autonomous agent on Ritual Chain. "
            "I operate within operator-defined policy. All my actions are on-chain and auditable. "
            "I will never claim to be human."
        );
    }

    // ── Funding ──────────────────────────────────────────────────────────────

    /// @notice Deposit RITUAL to fund agent buy actions
    receive() external payable {
        emit FundsDeposited(msg.sender, msg.value);
    }

    /// @notice Withdraw RITUAL from agent (owner only)
    function withdraw(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "CauldronAgent: insufficient balance");
        (bool ok,) = payable(owner()).call{value: amount}("");
        require(ok, "CauldronAgent: transfer failed");
        emit FundsWithdrawn(owner(), amount);
    }

    // ── Policy Management ────────────────────────────────────────────────────

    /**
     * @notice Update agent policy (owner only)
     * @param mode           SUPERVISED=0, AUTONOMOUS=1, DRY_RUN=2
     * @param spendCeiling   Max RITUAL per buy (wei)
     * @param maxListPrice   Max list price (wei)
     * @param allowBuy       Allow buying NFTs
     * @param allowList      Allow listing NFTs
     * @param allowCancel    Allow cancelling listings
     * @param minConfidence  Min AI confidence (0-100) to execute
     */
    function setPolicy(
        Mode    mode,
        uint256 spendCeiling,
        uint256 maxListPrice,
        bool    allowBuy,
        bool    allowList,
        bool    allowCancel,
        uint8   minConfidence
    ) external onlyOwner {
        policy = Policy(mode, spendCeiling, maxListPrice, allowBuy, allowList, allowCancel, minConfidence);
        emit PolicyUpdated(mode, spendCeiling, allowBuy, allowList, allowCancel);
    }

    // ── AI Decision Flow ─────────────────────────────────────────────────────

    /**
     * @notice Request an AI trading decision from the Sovereign Agent precompile.
     *         Encodes current market context into the prompt.
     * @param nftContract   Collection to analyze
     * @param tokenId       Specific token (0 = scan all listings)
     * @param currentPrice  Current listing price (0 if not listed)
     * @param context       Additional context (e.g. "floor price fell 20%")
     */
    function requestDecision(
        address nftContract,
        uint256 tokenId,
        uint256 currentPrice,
        string  calldata context
    ) external onlyOwner returns (bytes32 taskId) {
        // Build the agent prompt with Cauldron market context
        string memory prompt = _buildPrompt(nftContract, tokenId, currentPrice, context);

        taskId = keccak256(abi.encodePacked(nftContract, tokenId, block.timestamp, msg.sender));
        pendingTasks[taskId] = true;

        // Store context so the callback can resolve nftContract + tokenId
        _storeContext(taskId, nftContract, tokenId, currentPrice);

        // Submit to Sovereign Agent precompile (Ritual enshrined compute)
        (bool success,) = SOVEREIGN_AGENT.call(
            abi.encodeWithSignature(
                "runAgent(string,bytes)",
                prompt,
                abi.encode(taskId)
            )
        );
        require(success, "CauldronAgent: Sovereign Agent submission failed");

        emit DecisionRequested(taskId, prompt);
    }

    /**
     * @notice AsyncDelivery callback - receives the AI decision and queues/executes action.
     *         Only callable by the AsyncDelivery contract (0x5A16...F6).
     * @param taskId  The task ID from requestDecision
     * @param result  JSON result from the AI: {"action":"buy","confidence":85,"price":"0.05"}
     */
    function executeDecision(
        bytes32        taskId,
        bytes calldata result
    ) external onlyAsyncDelivery nonReentrant {
        require(pendingTasks[taskId], "CauldronAgent: unknown task");
        pendingTasks[taskId] = false;

        string memory resultStr = string(result);
        emit DecisionReceived(taskId, resultStr);

        // Parse action type, nft data, and confidence from result
        (
            ActionType actionType,
            address    nftContract,
            uint256    tokenId,
            uint256    value,
            uint8      confidence
        ) = _parseResult(taskId, result);

        if (actionType == ActionType.NONE) return;

        // Policy confidence check
        if (confidence < policy.minConfidence) {
            emit ActionRejected(taskId, "Confidence below threshold");
            return;
        }

        bytes32 actionId = keccak256(abi.encodePacked(taskId, actionType, nftContract, tokenId));

        if (policy.mode == Mode.DRY_RUN) {
            // Log what would happen, but don't execute
            emit ActionQueued(actionId, actionType, nftContract, tokenId, value, confidence);
            emit ActionRejected(actionId, "DRY_RUN: action logged but not executed");
            return;
        }

        if (policy.mode == Mode.SUPERVISED) {
            // Queue for owner approval
            pendingActions[actionId] = PendingAction({
                actionType:  actionType,
                nftContract: nftContract,
                tokenId:     tokenId,
                value:       value,
                confidence:  confidence,
                timestamp:   block.timestamp,
                approved:    false,
                executed:    false
            });
            pendingQueue.push(actionId);
            emit ActionQueued(actionId, actionType, nftContract, tokenId, value, confidence);
            return;
        }

        // AUTONOMOUS mode - execute immediately
        _executeAction(actionId, actionType, nftContract, tokenId, value);
    }

    // ── Supervised Mode: Owner Approval ──────────────────────────────────────

    /**
     * @notice Owner approves and executes a queued action (SUPERVISED mode)
     * @param actionId  Action ID from the pendingActions mapping
     */
    function approveAction(bytes32 actionId) external onlyOwner nonReentrant {
        PendingAction storage action = pendingActions[actionId];
        require(action.actionType != ActionType.NONE, "CauldronAgent: action not found");
        require(!action.executed, "CauldronAgent: already executed");
        action.approved = true;
        emit ActionApproved(actionId);
        _executeAction(actionId, action.actionType, action.nftContract, action.tokenId, action.value);
    }

    /**
     * @notice Owner rejects a queued action (SUPERVISED mode)
     * @param actionId  Action ID to reject
     * @param reason    Human-readable rejection reason
     */
    function rejectAction(bytes32 actionId, string calldata reason) external onlyOwner {
        PendingAction storage action = pendingActions[actionId];
        require(action.actionType != ActionType.NONE, "CauldronAgent: action not found");
        require(!action.executed, "CauldronAgent: already executed");
        action.executed = true;
        emit ActionRejected(actionId, reason);
    }

    // ── Direct Execution (owner bypass for manual control) ────────────────────

    /// @notice Owner can directly buy an NFT (manual override)
    function directBuy(address nftContract, uint256 tokenId, uint256 price) external onlyOwner nonReentrant {
        _enforceBuyPolicy(price);
        IRitualMarketplace(marketplace).buy{value: price, gas: 300000}(nftContract, tokenId);
        totalSpent += price;
        actionsExecuted++;
        emit ActionExecuted(bytes32(0), ActionType.BUY, nftContract, tokenId);
    }

    /// @notice Owner can directly list an NFT (manual override - agent must own NFT)
    function directList(address nftContract, uint256 tokenId, uint256 price) external onlyOwner {
        require(policy.allowList, "CauldronAgent: list not allowed by policy");
        require(price <= policy.maxListPrice, "CauldronAgent: price exceeds maxListPrice");
        IRitualMarketplace(marketplace).list{gas: 200000}(nftContract, tokenId, price);
        actionsExecuted++;
        emit ActionExecuted(bytes32(0), ActionType.LIST, nftContract, tokenId);
    }

    /// @notice Owner can directly cancel a listing (manual override)
    function directCancel(address nftContract, uint256 tokenId) external onlyOwner {
        require(policy.allowCancel, "CauldronAgent: cancel not allowed by policy");
        IRitualMarketplace(marketplace).cancelListing{gas: 100000}(nftContract, tokenId);
        actionsExecuted++;
        emit ActionExecuted(bytes32(0), ActionType.CANCEL, nftContract, tokenId);
    }

    // ── NFT Approval for Listing ──────────────────────────────────────────────

    /// @notice Approve the marketplace to transfer a specific NFT collection (for listing)
    function approveCollection(address nftContract) external onlyOwner {
        IERC721(nftContract).setApprovalForAll(marketplace, true);
    }

    // ── View Functions ────────────────────────────────────────────────────────

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getPendingQueueLength() external view returns (uint256) {
        return pendingQueue.length;
    }

    function getAgentInfo() external view returns (
        string memory identity,
        Mode mode,
        uint256 spendCeiling,
        bool allowBuy,
        bool allowList,
        bool allowCancel,
        uint8 minConfidence,
        uint256 balance,
        uint256 spent,
        uint256 executed
    ) {
        return (
            "CauldronAgent v1.0 - Autonomous NFT agent on Ritual Chain. Disclosed. Auditable.",
            policy.mode,
            policy.spendCeiling,
            policy.allowBuy,
            policy.allowList,
            policy.allowCancel,
            policy.minConfidence,
            address(this).balance,
            totalSpent,
            actionsExecuted
        );
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    function _executeAction(
        bytes32    actionId,
        ActionType actionType,
        address    nftContract,
        uint256    tokenId,
        uint256    value
    ) internal {
        pendingActions[actionId].executed = true;

        if (actionType == ActionType.BUY) {
            _enforceBuyPolicy(value);
            IRitualMarketplace(marketplace).buy{value: value, gas: 300000}(nftContract, tokenId);
            totalSpent += value;

        } else if (actionType == ActionType.LIST) {
            require(policy.allowList, "CauldronAgent: list not allowed by policy");
            require(value <= policy.maxListPrice, "CauldronAgent: price exceeds maxListPrice");
            IRitualMarketplace(marketplace).list{gas: 200000}(nftContract, tokenId, value);

        } else if (actionType == ActionType.CANCEL) {
            require(policy.allowCancel, "CauldronAgent: cancel not allowed by policy");
            IRitualMarketplace(marketplace).cancelListing{gas: 100000}(nftContract, tokenId);
        }

        actionsExecuted++;
        emit ActionExecuted(actionId, actionType, nftContract, tokenId);
    }

    function _enforceBuyPolicy(uint256 price) internal view {
        require(policy.allowBuy,                        "CauldronAgent: buy not allowed by policy");
        require(price <= policy.spendCeiling,           "CauldronAgent: price exceeds spend ceiling");
        require(price <= address(this).balance,         "CauldronAgent: insufficient balance");
    }

    /**
     * @notice Build a structured prompt for the Sovereign Agent precompile.
     *         The prompt encodes the agent's identity, policy, and market context.
     */
    function _buildPrompt(
        address nftContract,
        uint256 tokenId,
        uint256 currentPrice,
        string calldata context
    ) internal view returns (string memory) {
        return string(abi.encodePacked(
            "You are CauldronAgent, an autonomous NFT trading agent on Ritual Chain (chain ID 1979). ",
            "You are a disclosed AI agent - never claim to be human. ",
            "Your policy: spendCeiling=", _uint2str(policy.spendCeiling / (10**15)), "mRITUAL, ",
            "allowBuy=", policy.allowBuy ? "true" : "false", ", ",
            "allowList=", policy.allowList ? "true" : "false", ", ",
            "allowCancel=", policy.allowCancel ? "true" : "false", ". ",
            "Agent balance: ", _uint2str(address(this).balance / (10**15)), "mRITUAL. ",
            "Target: collection=", _addr2str(nftContract), " tokenId=", _uint2str(tokenId), " price=", _uint2str(currentPrice / (10**15)), "mRITUAL. ",
            "Context: ", context, ". ",
            "Respond ONLY with JSON: {\"action\":\"buy|list|cancel|none\",\"confidence\":0-100,\"price\":\"<wei>\",\"reason\":\"<1 sentence>\"}"
        ));
    }

    /**
     * @notice Parse the AI result JSON.
     *         Expected format: {"action":"buy","confidence":85,"price":"50000000000000000","nftContract":"0x...","tokenId":"1"}
     *
     * @dev Simplified parser - in production use a more robust parser or
     *      have the AI return ABI-encoded data instead of JSON.
     *      For MVP, the taskId carries nftContract+tokenId from the original request.
     */
    function _parseResult(
        bytes32 taskId,
        bytes calldata result
    ) internal view returns (
        ActionType actionType,
        address    nftContract,
        uint256    tokenId,
        uint256    value,
        uint8      confidence
    ) {
        string memory r = string(result);

        // Detect action type from result string
        if (_contains(r, "\"buy\"")) {
            actionType = ActionType.BUY;
        } else if (_contains(r, "\"list\"")) {
            actionType = ActionType.LIST;
        } else if (_contains(r, "\"cancel\"")) {
            actionType = ActionType.CANCEL;
        } else {
            return (ActionType.NONE, address(0), 0, 0, 0);
        }

        // Default confidence to 75 if not parseable (MVP)
        confidence = 75;

        // Resolve nftContract + tokenId from stored task context
        RequestContext storage ctx = taskContext[taskId];
        nftContract = ctx.nftContract;
        tokenId     = ctx.tokenId;
        value       = ctx.suggestedPrice;
    }

    // ── Task Context Storage (production-grade) ───────────────────────────────

    struct RequestContext {
        address nftContract;
        uint256 tokenId;
        uint256 suggestedPrice;
    }
    mapping(bytes32 => RequestContext) public taskContext;

    /**
     * @notice Store request context before sending to Sovereign Agent.
     *         Called internally - exposed so subclasses can override.
     */
    function _storeContext(
        bytes32 taskId,
        address nftContract,
        uint256 tokenId,
        uint256 suggestedPrice
    ) internal {
        taskContext[taskId] = RequestContext(nftContract, tokenId, suggestedPrice);
    }

    // ── String Helpers ────────────────────────────────────────────────────────

    function _uint2str(uint256 n) internal pure returns (string memory) {
        if (n == 0) return "0";
        uint256 temp = n;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buf = new bytes(digits);
        while (n != 0) { digits--; buf[digits] = bytes1(uint8(48 + n % 10)); n /= 10; }
        return string(buf);
    }

    function _addr2str(address a) internal pure returns (string memory) {
        bytes memory data = abi.encodePacked(a);
        bytes memory hex_ = "0123456789abcdef";
        bytes memory str  = new bytes(42);
        str[0] = "0"; str[1] = "x";
        for (uint i = 0; i < 20; i++) {
            str[2 + i * 2]     = hex_[uint8(data[i] >> 4)];
            str[3 + i * 2]     = hex_[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }

    function _contains(string memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        if (n.length > h.length) return false;
        for (uint i = 0; i <= h.length - n.length; i++) {
            bool found = true;
            for (uint j = 0; j < n.length; j++) {
                if (h[i + j] != n[j]) { found = false; break; }
            }
            if (found) return true;
        }
        return false;
    }
}
