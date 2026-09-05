const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with", deployer.address);

  const ApexUSDT = await hre.ethers.getContractFactory("ApexUSDT");
  const token = await ApexUSDT.deploy(deployer.address);
  await token.deployed();
  console.log("ApexUSDT deployed to:", token.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
