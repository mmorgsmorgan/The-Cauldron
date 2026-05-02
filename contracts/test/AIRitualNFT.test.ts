import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { MerkleTree } from "merkletreejs";
import { keccak256 } from "ethers";

describe("AIRitualNFT", function () {
  async function deployFixture() {
    const [owner, user1, user2, user3, notAllowlisted] = await ethers.getSigners();

    const AIRitualNFT = await ethers.getContractFactory("AIRitualNFT");
    const nft = await AIRitualNFT.deploy();
    await nft.waitForDeployment();

    // Build Merkle tree for allowlist
    const allowlist = [user1.address, user2.address, user3.address];
    const leaves = allowlist.map((addr) => keccak256(addr));
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const merkleRoot = tree.getHexRoot();

    const now = Math.floor(Date.now() / 1000);
    const phases = [
      {
        startTime: now - 100,
        endTime: now + 3600,
        price: ethers.parseEther("0.01"),
        maxPerWallet: 3,
        merkleRoot: merkleRoot,
        isPublic: false,
      },
      {
        startTime: now + 3600,
        endTime: now + 7200,
        price: ethers.parseEther("0.02"),
        maxPerWallet: 5,
        merkleRoot: ethers.ZeroHash,
        isPublic: true,
      },
    ];

    await nft.initialize(
      "TestCollection",
      "TC",
      "ipfs://QmTest/",
      100,
      owner.address,
      500, // 5% royalty
      owner.address,
      phases
    );

    return { nft, owner, user1, user2, user3, notAllowlisted, tree, phases };
  }

  describe("Initialization", function () {
    it("should initialize correctly", async function () {
      const { nft } = await loadFixture(deployFixture);
      expect(await nft.maxSupply()).to.equal(100);
      expect(await nft.totalPhases()).to.equal(2);
      expect(await nft.initialized()).to.equal(true);
    });

    it("should not allow double initialization", async function () {
      const { nft, owner } = await loadFixture(deployFixture);
      await expect(
        nft.initialize("X", "X", "", 1, owner.address, 0, owner.address, [])
      ).to.be.revertedWith("Already initialized");
    });

    it("should reject royalty above 10%", async function () {
      const AIRitualNFT = await ethers.getContractFactory("AIRitualNFT");
      const nft2 = await AIRitualNFT.deploy();
      await nft2.waitForDeployment();
      const [owner] = await ethers.getSigners();

      await expect(
        nft2.initialize("X", "X", "", 10, owner.address, 1001, owner.address, [])
      ).to.be.revertedWithCustomError(nft2, "RoyaltyTooHigh");
    });
  });

  describe("Allowlist Minting", function () {
    it("should allow allowlisted user to mint", async function () {
      const { nft, user1, tree } = await loadFixture(deployFixture);
      const leaf = keccak256(user1.address);
      const proof = tree.getHexProof(leaf);

      await nft.connect(user1).allowlistMint(0, 1, proof, {
        value: ethers.parseEther("0.01"),
      });

      expect(await nft.balanceOf(user1.address)).to.equal(1);
      expect(await nft.ownerOf(1)).to.equal(user1.address);
    });

    it("should reject invalid proof", async function () {
      const { nft, notAllowlisted, tree } = await loadFixture(deployFixture);
      const fakeLeaf = keccak256(notAllowlisted.address);
      const proof = tree.getHexProof(fakeLeaf);

      await expect(
        nft.connect(notAllowlisted).allowlistMint(0, 1, proof, {
          value: ethers.parseEther("0.01"),
        })
      ).to.be.revertedWithCustomError(nft, "InvalidProof");
    });

    it("should enforce wallet limit per phase", async function () {
      const { nft, user1, tree } = await loadFixture(deployFixture);
      const leaf = keccak256(user1.address);
      const proof = tree.getHexProof(leaf);

      // Mint 3 (max)
      await nft.connect(user1).allowlistMint(0, 3, proof, {
        value: ethers.parseEther("0.03"),
      });

      // Try 1 more — should fail
      await expect(
        nft.connect(user1).allowlistMint(0, 1, proof, {
          value: ethers.parseEther("0.01"),
        })
      ).to.be.revertedWithCustomError(nft, "WalletLimitExceeded");
    });

    it("should reject insufficient payment", async function () {
      const { nft, user1, tree } = await loadFixture(deployFixture);
      const leaf = keccak256(user1.address);
      const proof = tree.getHexProof(leaf);

      await expect(
        nft.connect(user1).allowlistMint(0, 1, proof, {
          value: ethers.parseEther("0.001"),
        })
      ).to.be.revertedWithCustomError(nft, "InsufficientPayment");
    });
  });

  describe("Public Minting", function () {
    it("should allow public mint when phase is active", async function () {
      const { nft, user1, phases } = await loadFixture(deployFixture);

      // Fast-forward time to public phase
      await ethers.provider.send("evm_setNextBlockTimestamp", [phases[1].startTime + 10]);
      await ethers.provider.send("evm_mine", []);

      await nft.connect(user1).publicMint(1, 2, {
        value: ethers.parseEther("0.04"),
      });

      expect(await nft.balanceOf(user1.address)).to.equal(2);
    });

    it("should reject publicMint on allowlist phase", async function () {
      const { nft, user1 } = await loadFixture(deployFixture);

      await expect(
        nft.connect(user1).publicMint(0, 1, {
          value: ethers.parseEther("0.01"),
        })
      ).to.be.revertedWithCustomError(nft, "PhaseNotPublic");
    });
  });

  describe("Owner Mint", function () {
    it("should allow owner to mint for free", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFixture);
      await nft.connect(owner).ownerMint(user1.address, 5);
      expect(await nft.balanceOf(user1.address)).to.equal(5);
    });

    it("should reject non-owner mint", async function () {
      const { nft, user1, user2 } = await loadFixture(deployFixture);
      await expect(
        nft.connect(user1).ownerMint(user2.address, 1)
      ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
    });
  });

  describe("Royalties (ERC-2981)", function () {
    it("should return correct royalty info", async function () {
      const { nft, owner } = await loadFixture(deployFixture);
      const [receiver, amount] = await nft.royaltyInfo(1, ethers.parseEther("1"));
      expect(receiver).to.equal(owner.address);
      expect(amount).to.equal(ethers.parseEther("0.05")); // 5%
    });
  });

  describe("Admin Functions", function () {
    it("should update merkle root", async function () {
      const { nft, owner } = await loadFixture(deployFixture);
      const newRoot = ethers.keccak256(ethers.toUtf8Bytes("newroot"));
      await nft.connect(owner).setMerkleRoot(0, newRoot);
      const phase = await nft.getPhase(0);
      expect(phase.merkleRoot).to.equal(newRoot);
    });

    it("should update base URI", async function () {
      const { nft, owner } = await loadFixture(deployFixture);
      await nft.connect(owner).setBaseURI("ipfs://QmNewURI/");
    });

    it("should withdraw funds", async function () {
      const { nft, owner, user1, tree } = await loadFixture(deployFixture);
      const leaf = keccak256(user1.address);
      const proof = tree.getHexProof(leaf);

      await nft.connect(user1).allowlistMint(0, 1, proof, {
        value: ethers.parseEther("0.01"),
      });

      const balBefore = await ethers.provider.getBalance(owner.address);
      await nft.connect(owner).withdraw();
      const balAfter = await ethers.provider.getBalance(owner.address);

      expect(balAfter).to.be.gt(balBefore);
    });
  });
});
