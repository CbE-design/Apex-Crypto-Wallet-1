require('dotenv').config();
const express = require('express');
const { ethers } = require('ethers');

const app = express();
app.use(express.json());

const RPC = process.env.BASE_RPC;
if (!RPC) {
  console.error('BASE_RPC not set');
  process.exit(1);
}
const provider = new ethers.providers.JsonRpcProvider(RPC);
const TREASURY_KEY = process.env.TREASURY_KEY;
if (!TREASURY_KEY) {
  console.error('TREASURY_KEY not set');
  process.exit(1);
}
const wallet = new ethers.Wallet(TREASURY_KEY, provider);
const tokenAddress = process.env.TOKEN_ADDRESS;
if (!tokenAddress) {
  console.error('TOKEN_ADDRESS not set');
  process.exit(1);
}

// Minimal ABI containing only the mint function
const tokenAbi = [
  {
    "inputs": [
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "mint",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const token = new ethers.Contract(tokenAddress, tokenAbi, wallet);

// TODO: Replace this with real DB lookup / internal ledger
async function getUserInternalBalance(userId) {
  // placeholder: implement your DB or Firebase lookup here
  // return numeric amount (e.g., 1000 for 1000 USDT)
  return 1000;
}

app.post('/api/mint-request', async (req, res) => {
  const { userId, metamaskAddress, amount } = req.body;
  if (!userId || !metamaskAddress || typeof amount === 'undefined') return res.status(400).send('missing');

  // Verify internal balance
  const internalBalance = await getUserInternalBalance(userId);
  if (internalBalance < amount) return res.status(400).send('insufficient internal balance');

  // Convert to token base units (6 decimals)
  const amountUnits = ethers.BigNumber.from(amount).mul(ethers.BigNumber.from(10).pow(6));

  try {
    const tx = await token.mint(metamaskAddress, amountUnits, { gasLimit: 300000 });
    // TODO: update DB: mark amount as minted/pending using tx.hash
    res.json({ txHash: tx.hash });
  } catch (err) {
    console.error('mint error', err);
    res.status(500).send('mint failed');
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Mint server listening on ${PORT}`));
