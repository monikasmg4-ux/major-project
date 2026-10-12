try {
  require("@nomicfoundation/hardhat-toolbox");
} catch (e) {
  // Fallback to standalone hardhat compilation if full toolbox peer deps are not installed
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    }
  },
  paths: {
    sources: "./contracts",
    artifacts: "./artifacts"
  }
};
