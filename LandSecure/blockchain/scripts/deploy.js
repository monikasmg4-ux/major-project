const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying LandRegistry smart contract...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

  // Deploy contract
  const LandRegistry = await ethers.getContractFactory("LandRegistry");
  const landRegistry = await LandRegistry.deploy();
  await landRegistry.waitForDeployment();

  const contractAddress = await landRegistry.getAddress();
  console.log("✅ LandRegistry deployed to:", contractAddress);

  // Save deployment info for the backend
  const deploymentInfo = {
    contractAddress: contractAddress,
    deployer: deployer.address,
    network: "localhost",
    deployedAt: new Date().toISOString()
  };

  // Save to blockchain directory
  const outputPath = path.join(__dirname, "..", "deployedAddress.json");
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("📄 Deployment info saved to:", outputPath);

  // Also copy ABI to backend for contract interaction
  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "LandRegistry.sol",
    "LandRegistry.json"
  );

  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const abiOutputPath = path.join(
      __dirname,
      "..",
      "..",
      "backend",
      "contracts",
      "LandRegistryABI.json"
    );

    // Ensure directory exists
    const abiDir = path.dirname(abiOutputPath);
    if (!fs.existsSync(abiDir)) {
      fs.mkdirSync(abiDir, { recursive: true });
    }

    fs.writeFileSync(
      abiOutputPath,
      JSON.stringify({ abi: artifact.abi, address: contractAddress }, null, 2)
    );
    console.log("📄 ABI copied to backend:", abiOutputPath);
  }

  console.log("\n🎉 Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
