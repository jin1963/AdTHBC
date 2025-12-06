// thbc-config.js – Owner Panel for THBC

// BNB Smart Chain mainnet
const THBC_CHAIN_ID = 56;

// THBC token (18 decimals)
const THBC_ADDRESS = "0xe8d4687b77B5611eF1828FDa7428034FA12a1Beb";

// THBC ABI แบบย่อ (ต้องให้ตรงกับสัญญา THBC จริง ถ้าชื่อฟังก์ชันต่างให้แก้ตรงนี้)
const THBC_OWNER_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",

  // ต้องมีในสัญญา THBC จริง ๆ
  "function owner() view returns (address)",
  "function mint(address to, uint256 amount) external",
  "function burn(uint256 amount) external"
];

window.THBC_OWNER_CONFIG = {
  chainId: THBC_CHAIN_ID,
  token: {
    address: THBC_ADDRESS,
    abi: THBC_OWNER_ABI
  }
};
