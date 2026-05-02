import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("NFTFactory", function () {
  async function deployFixture() {
    const [owner, creator1, creator2] = await ethers.getSigners();

    // Deploy implementation
    const AIRitualNFT = await ethers.getContractFactory("AIRitualNFT");
    const implementation = await AIRitualNFT.deploy();
    await implementation.waitForDeployment();

    // Deploy factory
    const NFTFactory = await ethers.getContractFactory("NFTFactory");
    const factory = await NFTFactory.deploy(await implementation.getAddress());
    await factory.waitForDeployment();

    const now = Math.floor(Date.now() / 1000);
    const defaultPhases = [
      {
        startTime: now,
        endTime: now + 7200,
        price: ethers.parseEther("0.01"),
        maxPerWallet: 5,
        merkleRoot: ethers.ZeroHash,
        isPublic: true,
      },
    ];

    return { factory, implementation, owner, creator1, creator2, defaultPhases };
  }

  describe("Collection Deployment", function () {
    it("should deploy a new collection", async function () {
      const { factory, creator1, defaultPhases } = await loadFixture(deployFixture);

      const tx = await factory.connect(creator1).createCollection(
        "My Collection",
        "MC",
        "ipfs://QmTest/",
        1000,
        creator1.address,
        500,
        defaultPhases
      );

      const receipt = await tx.wait();
      expect(await factory.totalCollections()).to.equal(1);

      const collections = await factory.getCollectionsByOwner(creator1.address);
      expect(collections.length).to.equal(1);
    });

    it("should mark factory-deployed collections as official", async function () {
      const { factory, creator1, defaultPhases } = await loadFixture(deployFixture);

      await factory.connect(creator1).createCollection(
        "Official",
        "OFF",
        "ipfs://Qm/",
        100,
        creator1.address,
        0,
        defaultPhases
      );

      const collections = await factory.getCollectionsByOwner(creator1.address);
      expect(await factory.isOfficialCollection(collections[0])).to.equal(true);
    });

    it("should allow minting on cloned collection", async function () {
      const { factory, creator1, defaultPhases } = await loadFixture(deployFixture);

      await factory.connect(creator1).createCollection(
        "Mintable",
        "MINT",
        "ipfs://Qm/",
        100,
        creator1.address,
        0,
        defaultPhases
      );

      const collections = await factory.getCollectionsByOwner(creator1.address);
      const nft = await ethers.getContractAt("AIRitualNFT", collections[0]);

      await nft.connect(creator1).publicMint(0, 2, {
        value: ethers.parseEther("0.02"),
      });

      expect(await nft.balanceOf(creator1.address)).to.equal(2);
    });

    it("should deploy multiple collections per creator", async function () {
      const { factory, creator1, defaultPhases } = await loadFixture(deployFixture);

      await factory.connect(creator1).createCollection("A", "A", "", 10, creator1.address, 0, defaultPhases);
      await factory.connect(creator1).createCollection("B", "B", "", 20, creator1.address, 0, defaultPhases);

      expect(await factory.totalCollections()).to.equal(2);
      const collections = await factory.getCollectionsByOwner(creator1.address);
      expect(collections.length).to.equal(2);
    });

    it("should predict clone address correctly", async function () {
      const { factory, creator1, defaultPhases } = await loadFixture(deployFixture);

      const predicted = await factory.predictAddress(creator1.address);
      await factory.connect(creator1).createCollection("P", "P", "", 10, creator1.address, 0, defaultPhases);

      const collections = await factory.getCollectionsByOwner(creator1.address);
      expect(collections[0]).to.equal(predicted);
    });
  });

  describe("Admin", function () {
    it("should allow owner to update implementation", async function () {
      const { factory, owner, implementation } = await loadFixture(deployFixture);
      const AIRitualNFT = await ethers.getContractFactory("AIRitualNFT");
      const newImpl = await AIRitualNFT.deploy();
      await newImpl.waitForDeployment();

      await factory.connect(owner).setImplementation(await newImpl.getAddress());
      expect(await factory.implementation()).to.equal(await newImpl.getAddress());
    });
  });
});
