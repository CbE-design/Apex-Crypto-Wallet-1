# Apex USDT integration notes

Files added in branch `feature/apexusdt-token`:

- contracts/ApexUSDT.sol  -- ERC20 token contract with symbol "USDT" and 6 decimals
- hardhat.config.js       -- Hardhat configuration for Base network (uses env vars)
- scripts/deploy.js       -- Deploy script to deploy ApexUSDT
- package.json            -- Hardhat project dependencies and scripts
- backend/index.js        -- Simple Express backend exposing /api/mint-request
- backend/package.json    -- Backend dependencies
- src/lib/mintApexUsdt.ts -- Frontend helper to call the mint endpoint and add token to MetaMask
- README_APEX_USDT.md     -- Integration and deployment notes

Environment variables required:
- BASE_RPC      RPC URL for Base network
- DEPLOYER_KEY  Private key for deployment (used by hardhat deploy)
- TREASURY_KEY  Private key for the treasury account that will own MINTER_ROLE
- TOKEN_ADDRESS The deployed ApexUSDT contract address (used by backend)

Next steps:
1. Review the contract and change the constructor admin address if necessary.
2. Install dependencies and compile/deploy to a testnet or Base testnet.
3. Provide the deployed TOKEN_ADDRESS and set TREASURY_KEY on the server.
4. Implement real internal balance checks in backend/getUserInternalBalance.
5. Add authentication/authorization to the mint endpoint.

I can open a PR with these files on a branch in this repository if you'd like; let me know and I'll create the pull request.