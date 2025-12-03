// config.js - Kaojino THBC Exchange

// ----------------- USDT (BSC) -----------------
const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955"; // USDT-BSC 18 decimals

// ใช้ ABI แบบสั้น เฉพาะฟังก์ชันที่เราเรียกจริง ๆ
const USDT_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

// ----------------- THBC Token -----------------
const THBC_ADDRESS = "0xe8d4687b77B5611eF1828FDa7428034FA12a1Beb";
const THBC_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

// ----------------- KaojinoTHBCExchange -----------------
const EXCHANGE_ADDRESS = "0xe584224ec67a1e6CC52B83023fc5336b12664a3d";

// เอาเฉพาะฟังก์ชันที่เราใช้ก็พอ
const EXCHANGE_ABI = [
  "function buyTHBCWithUSDT(uint256 usdtAmount, address referrer) external",
  "function getReferralRates() view returns (uint256 level1Bps, uint256 level2Bps, uint256 level3Bps)",
  "function getReferrers(address user) view returns (address ref1, address ref2, address ref3)"
];

// ----------------- CONFIG OBJECT -----------------
window.THBC_CONFIG = {
  uiRateThbcPerUsdt: 35, // ใช้โชว์ในหน้าเว็บ

  usdt: {
    address: USDT_ADDRESS,
    abi: USDT_ABI
  },

  thbc: {
    address: THBC_ADDRESS,
    abi: THBC_ABI
  },

  exchange: {
    address: EXCHANGE_ADDRESS,
    abi: EXCHANGE_ABI
  }
};
