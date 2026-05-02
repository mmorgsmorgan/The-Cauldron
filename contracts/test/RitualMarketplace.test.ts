import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("RitualMarketplace", function () {
  async function deployFixture() {
    const [owner, seller, buyer, royaltyReceiver] = await ethers.getSigners();

    // Deploy NFT implementation + Factory
    const AIRitualNFT = await ethers.getContractFactory("AIRitualNFT");
    const impl = await AIRitualNFT.deploy();
    await impl.waitForDeployment();

    const NFTFactory = await ethers.getContractFactory("NFTFactory");
    const factory = await NFTFactory.deploy(await impl.getAddress());
    await factory.waitForDeployment();

    // Deploy Marketplace (2.5% fee)
    const RitualMarketplace = await ethers.getContractFactory("RitualMarketplace");
    const marketplace = await RitualMarketplace.deploy(250, owner.address);
    await marketplace.waitForDeployment();

    // Create a collection and mint tokens to seller
    const now = Math.floor(Date.now() / 1000);
    await factory.connect(seller).createCollection(
      "TestNFT",
      "TNFT",
      "ipfs://Qm/",
      100,
      royaltyReceiver.address,
      500, // 5% royalty
      [
        {
          startTime: now - 100,
          endTime: now + 7200,
          price: ethers.parseEther("0.01"),
          maxPerWallet: 10,
          merkleRoot: ethers.ZeroHash,
          isPublic: true,
        },
      ]
    );

    const collections = await factory.getCollectionsByOwner(seller.address);
    const nft = await ethers.getContractAt("AIRitualNFT", collections[0]);

    // Seller mints 3 tokens
    await nft.connect(seller).publicMint(0, 3, {
      value: ethers.parseEther("0.03"),
    });

    // Seller approves marketplace
    await nft.connect(seller).setApprovalForAll(await marketplace.getAddress(), true);

    return { marketplace, nft, factory, owner, seller, buyer, royaltyReceiver };
  }

  describe("Listing", function () {
    it("should list an NFT", async function () {
      const { marketplace, nft, seller } = await loadFixture(deployFixture);

      await marketplace.connect(seller).list(
        await nft.getAddress(),
        1,
        ethers.parseEther("1")
      );

      const listing = await marketplace.getListing(await nft.getAddress(), 1);
      expect(listing.active).to.be.true;
      expect(listing.seller).to.equal(seller.address);
      expect(listing.price).to.equal(ethers.parseEther("1"));
    });

    it("should reject listing by non-owner", async function () {
      const { marketplace, nft, buyer } = await loadFixture(deployFixture);

      await expect(
        marketplace.connect(buyer).list(await nft.getAddress(), 1, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(marketplace, "NotTokenOwner");
    });

    it("should reject zero price", async function () {
      const { marketplace, nft, seller } = await loadFixture(deployFixture);

      await expect(
        marketplace.connect(seller).list(await nft.getAddress(), 1, 0)
      ).to.be.revertedWithCustomError(marketplace, "PriceZero");
    });

    it("should reject duplicate listing", async function () {
      const { marketplace, nft, seller } = await loadFixture(deployFixture);

      await marketplace.connect(seller).list(await nft.getAddress(), 1, ethers.parseEther("1"));

      await expect(
        marketplace.connect(seller).list(await nft.getAddress(), 1, ethers.parseEther("2"))
      ).to.be.revertedWithCustomError(marketplace, "AlreadyListed");
    });
  });

  describe("Buying", function () {
    it("should complete a buy with correct payment splits", async function () {
      const { marketplace, nft, seller, buyer, royaltyReceiver, owner } =
        await loadFixture(deployFixture);

      const price = ethers.parseEther("1");
      const nftAddr = await nft.getAddress();

      await marketplace.connect(seller).list(nftAddr, 1, price);

      const sellerBalBefore = await ethers.provider.getBalance(seller.address);
      const royaltyBalBefore = await ethers.provider.getBalance(royaltyReceiver.address);

      await marketplace.connect(buyer).buy(nftAddr, 1, { value: price });

      // NFT transferred to buyer
      expect(await nft.ownerOf(1)).to.equal(buyer.address);

      // Listing deactivated
      const listing = await marketplace.getListing(nftAddr, 1);
      expect(listing.active).to.be.false;

      // Seller received payment minus royalty (5%) and platform fee (2.5%)
      const sellerBalAfter = await ethers.provider.getBalance(seller.address);
      const royaltyBalAfter = await ethers.provider.getBalance(royaltyReceiver.address);

      // Royalty = 5% of 1 ETH = 0.05 ETH
      expect(royaltyBalAfter - royaltyBalBefore).to.equal(ethers.parseEther("0.05"));

      // Seller gets 1 - 0.05 (royalty) - 0.025 (platform) = 0.925 ETH
      expect(sellerBalAfter - sellerBalBefore).to.equal(ethers.parseEther("0.925"));
    });

    it("should reject insufficient payment", async function () {
      const { marketplace, nft, seller, buyer } = await loadFixture(deployFixture);
      const nftAddr = await nft.getAddress();

      await marketplace.connect(seller).list(nftAddr, 1, ethers.parseEther("1"));

      await expect(
        marketplace.connect(buyer).buy(nftAddr, 1, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWithCustomError(marketplace, "InsufficientPayment");
    });

    it("should refund excess payment", async function () {
      const { marketplace, nft, seller, buyer } = await loadFixture(deployFixture);
      const nftAddr = await nft.getAddress();

      await marketplace.connect(seller).list(nftAddr, 1, ethers.parseEther("1"));

      const balBefore = await ethers.provider.getBalance(buyer.address);
      const tx = await marketplace.connect(buyer).buy(nftAddr, 1, {
        value: ethers.parseEther("2"),
      });
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(buyer.address);

      // Buyer should have paid only 1 ETH + gas, excess refunded
      const spent = balBefore - balAfter - gasUsed;
      // Allow small tolerance for gas price variations
      expect(spent).to.be.closeTo(ethers.parseEther("1"), ethers.parseEther("0.001"));
    });
  });

  describe("Cancel Listing", function () {
    it("should allow seller to cancel", async function () {
      const { marketplace, nft, seller } = await loadFixture(deployFixture);
      const nftAddr = await nft.getAddress();

      await marketplace.connect(seller).list(nftAddr, 1, ethers.parseEther("1"));
      await marketplace.connect(seller).cancelListing(nftAddr, 1);

      const listing = await marketplace.getListing(nftAddr, 1);
      expect(listing.active).to.be.false;
    });

    it("should reject cancel by non-seller", async function () {
      const { marketplace, nft, seller, buyer } = await loadFixture(deployFixture);
      const nftAddr = await nft.getAddress();

      await marketplace.connect(seller).list(nftAddr, 1, ethers.parseEther("1"));

      await expect(
        marketplace.connect(buyer).cancelListing(nftAddr, 1)
      ).to.be.revertedWithCustomError(marketplace, "NotSeller");
    });
  });

  describe("Admin", function () {
    it("should update platform fee", async function () {
      const { marketplace, owner } = await loadFixture(deployFixture);
      await marketplace.connect(owner).setPlatformFee(500);
      expect(await marketplace.platformFee()).to.equal(500);
    });

    it("should reject fee above 10%", async function () {
      const { marketplace, owner } = await loadFixture(deployFixture);
      await expect(marketplace.connect(owner).setPlatformFee(1001)).to.be.revertedWith("Fee too high");
    });
  });
});
