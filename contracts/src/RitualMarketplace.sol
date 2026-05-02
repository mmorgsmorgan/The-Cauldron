// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

/**
 * @title RitualMarketplace
 * @notice Escrow-less NFT marketplace with ERC-2981 royalty enforcement.
 *         NFTs remain in the seller's wallet until purchased.
 *         Supports any ERC-721 contract on Ritual Chain.
 */
contract RitualMarketplace is ReentrancyGuard, Ownable {
    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────
    error NotTokenOwner();
    error NotSeller();
    error ListingNotActive();
    error InsufficientPayment();
    error PriceZero();
    error TransferFailed();
    error AlreadyListed();
    error NotApproved();

    // ──────────────────────────────────────────────
    //  Structs
    // ──────────────────────────────────────────────
    struct Listing {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 price;
        bool active;
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    /// @dev listingKey => Listing (key = keccak256(contract, tokenId))
    mapping(bytes32 => Listing) public listings;

    /// @dev Platform fee in basis points (e.g. 250 = 2.5%)
    uint256 public platformFee;
    address public feeRecipient;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────
    event ItemListed(
        address indexed seller,
        address indexed nftContract,
        uint256 indexed tokenId,
        uint256 price
    );
    event ItemBought(
        address indexed buyer,
        address indexed nftContract,
        uint256 indexed tokenId,
        uint256 price,
        address seller
    );
    event ItemCanceled(
        address indexed seller,
        address indexed nftContract,
        uint256 indexed tokenId
    );
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────
    constructor(uint256 platformFee_, address feeRecipient_) Ownable(msg.sender) {
        platformFee = platformFee_;
        feeRecipient = feeRecipient_;
    }

    // ──────────────────────────────────────────────
    //  Core Functions
    // ──────────────────────────────────────────────

    /**
     * @notice List an NFT for sale. The NFT stays in the seller's wallet.
     * @dev Seller must have approved this contract before listing.
     * @param nftContract Address of the ERC-721 contract
     * @param tokenId Token ID to list
     * @param price Sale price in wei
     */
    function list(
        address nftContract,
        uint256 tokenId,
        uint256 price
    ) external {
        if (price == 0) revert PriceZero();

        IERC721 nft = IERC721(nftContract);
        if (nft.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

        // Check approval
        if (
            !nft.isApprovedForAll(msg.sender, address(this)) &&
            nft.getApproved(tokenId) != address(this)
        ) revert NotApproved();

        bytes32 key = _listingKey(nftContract, tokenId);
        if (listings[key].active) revert AlreadyListed();

        listings[key] = Listing({
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            price: price,
            active: true
        });

        emit ItemListed(msg.sender, nftContract, tokenId, price);
    }

    /**
     * @notice Buy a listed NFT. Handles royalty + platform fee splits.
     * @param nftContract Address of the ERC-721 contract
     * @param tokenId Token ID to buy
     */
    function buy(
        address nftContract,
        uint256 tokenId
    ) external payable nonReentrant {
        bytes32 key = _listingKey(nftContract, tokenId);
        Listing storage listing = listings[key];

        if (!listing.active) revert ListingNotActive();
        if (msg.value < listing.price) revert InsufficientPayment();

        listing.active = false;

        uint256 salePrice = listing.price;
        address seller = listing.seller;
        uint256 royaltyAmount = 0;
        address royaltyReceiver = address(0);

        // Check ERC-2981 royalty
        try IERC2981(nftContract).royaltyInfo(tokenId, salePrice) returns (
            address receiver,
            uint256 amount
        ) {
            royaltyReceiver = receiver;
            royaltyAmount = amount;
        } catch {
            // Contract doesn't support ERC-2981 — no royalty
        }

        // Platform fee
        uint256 platformAmount = (salePrice * platformFee) / 10000;

        // Seller gets remainder
        uint256 sellerAmount = salePrice - royaltyAmount - platformAmount;

        // Transfer NFT to buyer
        IERC721(nftContract).safeTransferFrom(seller, msg.sender, tokenId);

        // Pay seller
        if (sellerAmount > 0) {
            (bool s1, ) = payable(seller).call{value: sellerAmount}("");
            if (!s1) revert TransferFailed();
        }

        // Pay royalty
        if (royaltyAmount > 0 && royaltyReceiver != address(0)) {
            (bool s2, ) = payable(royaltyReceiver).call{value: royaltyAmount}("");
            if (!s2) revert TransferFailed();
        }

        // Pay platform fee
        if (platformAmount > 0 && feeRecipient != address(0)) {
            (bool s3, ) = payable(feeRecipient).call{value: platformAmount}("");
            if (!s3) revert TransferFailed();
        }

        // Refund excess
        uint256 excess = msg.value - salePrice;
        if (excess > 0) {
            (bool s4, ) = payable(msg.sender).call{value: excess}("");
            if (!s4) revert TransferFailed();
        }

        emit ItemBought(msg.sender, nftContract, tokenId, salePrice, seller);
    }

    /**
     * @notice Cancel an active listing. Only the seller can cancel.
     * @param nftContract Address of the ERC-721 contract
     * @param tokenId Token ID to delist
     */
    function cancelListing(
        address nftContract,
        uint256 tokenId
    ) external {
        bytes32 key = _listingKey(nftContract, tokenId);
        Listing storage listing = listings[key];

        if (!listing.active) revert ListingNotActive();
        if (listing.seller != msg.sender) revert NotSeller();

        listing.active = false;

        emit ItemCanceled(msg.sender, nftContract, tokenId);
    }

    // ──────────────────────────────────────────────
    //  Views
    // ──────────────────────────────────────────────

    function getListing(
        address nftContract,
        uint256 tokenId
    ) external view returns (Listing memory) {
        return listings[_listingKey(nftContract, tokenId)];
    }

    function isListed(
        address nftContract,
        uint256 tokenId
    ) external view returns (bool) {
        return listings[_listingKey(nftContract, tokenId)].active;
    }

    // ──────────────────────────────────────────────
    //  Admin
    // ──────────────────────────────────────────────

    function setPlatformFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee too high"); // max 10%
        emit PlatformFeeUpdated(platformFee, newFee);
        platformFee = newFee;
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        feeRecipient = newRecipient;
    }

    // ──────────────────────────────────────────────
    //  Internal
    // ──────────────────────────────────────────────

    function _listingKey(
        address nftContract,
        uint256 tokenId
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(nftContract, tokenId));
    }
}
