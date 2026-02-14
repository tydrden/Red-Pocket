const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RedPacket", function () {
    async function deployFixture() {
        const [owner, creator, claimer1, claimer2, otherAccount] = await ethers.getSigners();

        // Deploy Mock Token (6 decimals like AlphaUSD)
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const token = await MockERC20.deploy("Alpha USD", "AlphaUSD");
        await token.waitForDeployment();

        // Deploy RedPacket
        const RedPacket = await ethers.getContractFactory("RedPacket");
        const redPacket = await RedPacket.deploy();
        await redPacket.waitForDeployment();

        // Mint tokens to creator and approve
        await token.mint(creator.address, ethers.parseUnits("1000", 6));
        await token.connect(creator).approve(redPacket.target, ethers.MaxUint256);

        return { redPacket, token, owner, creator, claimer1, claimer2, otherAccount };
    }

    describe("Core Flow", function () {
        it("Should create a packet (no question)", async function () {
            const { redPacket, token, creator } = await loadFixture(deployFixture);

            const ephemeral = ethers.Wallet.createRandom();
            const amount = ethers.parseUnits("10", 6);
            const count = 2;
            const duration = 3600;

            await expect(redPacket.connect(creator).createPacket(
                token.target,
                amount,
                count,
                false,
                ephemeral.address,
                ethers.ZeroAddress,
                duration,
                "Best Wishes",
                ethers.ZeroHash // No question
            )).to.emit(redPacket, "PacketCreated");
        });

        it("Should reject native ETH token address (address(0))", async function () {
            const { redPacket, creator } = await loadFixture(deployFixture);

            const ephemeral = ethers.Wallet.createRandom();

            await expect(redPacket.connect(creator).createPacket(
                ethers.ZeroAddress, // Should be rejected
                ethers.parseUnits("10", 6),
                2,
                false,
                ephemeral.address,
                ethers.ZeroAddress,
                3600,
                "Gift",
                ethers.ZeroHash
            )).to.be.revertedWithCustomError(redPacket, "InvalidAmount");
        });

        it("Should claim successfully with valid signature (no question)", async function () {
            const { redPacket, token, creator, claimer1 } = await loadFixture(deployFixture);

            const ephemeral = ethers.Wallet.createRandom();
            const amount = ethers.parseUnits("10", 6);
            const count = 2;

            // Create
            const tx = await redPacket.connect(creator).createPacket(
                token.target,
                amount,
                count,
                false,
                ephemeral.address,
                ethers.ZeroAddress,
                3600,
                "Gift",
                ethers.ZeroHash
            );
            const receipt = await tx.wait();
            const logs = await redPacket.queryFilter(redPacket.filters.PacketCreated(), receipt?.blockNumber);
            const packetId = logs[0].args[0];

            // Sign: keccak256(packetId, claimer)
            const hash = ethers.solidityPackedKeccak256(["bytes32", "address"], [packetId, claimer1.address]);
            const signature = await ephemeral.signMessage(ethers.getBytes(hash));

            // Claim (empty answer)
            await expect(redPacket.connect(claimer1).claim(packetId, signature, ""))
                .to.emit(redPacket, "Claimed")
                .withArgs(packetId, claimer1.address, ethers.parseUnits("5", 6));

            expect(await token.balanceOf(claimer1.address)).to.equal(ethers.parseUnits("5", 6));
        });

        it("Should enforce restrictedTo address", async function () {
            const { redPacket, token, creator, claimer1, claimer2 } = await loadFixture(deployFixture);

            const ephemeral = ethers.Wallet.createRandom();

            // Create restricted to claimer1
            const tx = await redPacket.connect(creator).createPacket(
                token.target,
                ethers.parseUnits("10", 6),
                1,
                false,
                ephemeral.address,
                claimer1.address,
                3600,
                "For You Only",
                ethers.ZeroHash
            );
            const receipt = await tx.wait();
            const logs = await redPacket.queryFilter(redPacket.filters.PacketCreated(), receipt?.blockNumber);
            const packetId = logs[0].args[0];

            // Claimer2 tries to claim
            const hash2 = ethers.solidityPackedKeccak256(["bytes32", "address"], [packetId, claimer2.address]);
            const signature2 = await ephemeral.signMessage(ethers.getBytes(hash2));

            await expect(redPacket.connect(claimer2).claim(packetId, signature2, ""))
                .to.be.revertedWithCustomError(redPacket, "NotEligible");

            // Claimer1 claims (direct recipient, empty signature)
            await expect(redPacket.connect(claimer1).claim(packetId, "0x", ""))
                .to.emit(redPacket, "Claimed");
        });
    });

    describe("Question-Answer Flow", function () {
        it("Should claim with correct answer", async function () {
            const { redPacket, token, creator, claimer1 } = await loadFixture(deployFixture);

            const ephemeral = ethers.Wallet.createRandom();
            const amount = ethers.parseUnits("10", 6);
            const answer = "pamuk";
            const answerHash = ethers.solidityPackedKeccak256(["string"], [answer]);

            // Create with question
            const tx = await redPacket.connect(creator).createPacket(
                token.target,
                amount,
                1,
                false,
                ephemeral.address,
                ethers.ZeroAddress,
                3600,
                "What is my cat's name?",
                answerHash
            );
            const receipt = await tx.wait();
            const logs = await redPacket.queryFilter(redPacket.filters.PacketCreated(), receipt?.blockNumber);
            const packetId = logs[0].args[0];

            // Sign
            const hash = ethers.solidityPackedKeccak256(["bytes32", "address"], [packetId, claimer1.address]);
            const signature = await ephemeral.signMessage(ethers.getBytes(hash));

            // Claim with correct answer (case-insensitive)
            await expect(redPacket.connect(claimer1).claim(packetId, signature, "Pamuk"))
                .to.emit(redPacket, "Claimed")
                .withArgs(packetId, claimer1.address, amount);
        });

        it("Should reject wrong answer", async function () {
            const { redPacket, token, creator, claimer1 } = await loadFixture(deployFixture);

            const ephemeral = ethers.Wallet.createRandom();
            const amount = ethers.parseUnits("10", 6);
            const answer = "pamuk";
            const answerHash = ethers.solidityPackedKeccak256(["string"], [answer]);

            // Create with question
            const tx = await redPacket.connect(creator).createPacket(
                token.target,
                amount,
                1,
                false,
                ephemeral.address,
                ethers.ZeroAddress,
                3600,
                "What is my cat's name?",
                answerHash
            );
            const receipt = await tx.wait();
            const logs = await redPacket.queryFilter(redPacket.filters.PacketCreated(), receipt?.blockNumber);
            const packetId = logs[0].args[0];

            // Sign
            const hash = ethers.solidityPackedKeccak256(["bytes32", "address"], [packetId, claimer1.address]);
            const signature = await ephemeral.signMessage(ethers.getBytes(hash));

            // Claim with wrong answer
            await expect(redPacket.connect(claimer1).claim(packetId, signature, "wrong"))
                .to.be.revertedWithCustomError(redPacket, "WrongAnswer");
        });
    });

    describe("Refund", function () {
        it("Should refund after expiry", async function () {
            const { redPacket, token, creator } = await loadFixture(deployFixture);

            const ephemeral = ethers.Wallet.createRandom();
            const amount = ethers.parseUnits("10", 6);

            // Create with short duration
            const tx = await redPacket.connect(creator).createPacket(
                token.target,
                amount,
                2,
                false,
                ephemeral.address,
                ethers.ZeroAddress,
                60, // 1 minute
                "Gift",
                ethers.ZeroHash
            );
            const receipt = await tx.wait();
            const logs = await redPacket.queryFilter(redPacket.filters.PacketCreated(), receipt?.blockNumber);
            const packetId = logs[0].args[0];

            // Try refund before expiry
            await expect(redPacket.connect(creator).refund(packetId))
                .to.be.revertedWithCustomError(redPacket, "PacketNotExpired");

            // Fast forward time
            await time.increase(61);

            const balanceBefore = await token.balanceOf(creator.address);

            // Refund
            await expect(redPacket.connect(creator).refund(packetId))
                .to.emit(redPacket, "Refunded")
                .withArgs(packetId, creator.address, amount);

            const balanceAfter = await token.balanceOf(creator.address);
            expect(balanceAfter - balanceBefore).to.equal(amount);
        });

        it("Should reject refund from non-creator", async function () {
            const { redPacket, token, creator, claimer1 } = await loadFixture(deployFixture);

            const ephemeral = ethers.Wallet.createRandom();
            const amount = ethers.parseUnits("10", 6);

            const tx = await redPacket.connect(creator).createPacket(
                token.target,
                amount,
                1,
                false,
                ephemeral.address,
                ethers.ZeroAddress,
                60,
                "Gift",
                ethers.ZeroHash
            );
            const receipt = await tx.wait();
            const logs = await redPacket.queryFilter(redPacket.filters.PacketCreated(), receipt?.blockNumber);
            const packetId = logs[0].args[0];

            await time.increase(61);

            // Non-creator tries refund
            await expect(redPacket.connect(claimer1).refund(packetId))
                .to.be.revertedWithCustomError(redPacket, "NotEligible");
        });
    });
});
