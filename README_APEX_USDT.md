# Apex USDT Minting Integration

This directory adds a USDT-like ERC20 token contract (ApexUSDT), Hardhat deployment scripts for the Base network, a simple backend mint endpoint, and a frontend helper to request mints and add the token to MetaMask.

Important: this project uses the symbol "USDT" as requested. Using the USDT symbol could be misleading and may have legal or branding implications — consider using a distinct symbol (e.g., "AUSDT") in production.

Environment variables (example .env):

BASE_RPC=https://base-mainnet.rpc.url
DEPLOYER_KEY=0x...
TREASURY_KEY=0x...
TOKEN_ADDRESS=0x...   # set after deploying the contract
PORT=3001

Deploy (after installing dependencies):

1. npm install
2. npx hardhat compile
3. npx hardhat run scripts/deploy.js --network base

Backend:
- See backend/README for instructions to run the minting server.

Frontend:
- Use src/lib/mintApexUsdt.ts to call the mint endpoint and add the token to MetaMask.
