// admin-thbc.js - Kaojino THBC Admin Panel (USDT -> THBC)

const OWNER_ADDRESS = "0xbfD941B45f6E9850Ba82510284426dFD3fBf25E2".toLowerCase();

let injected;
let provider;
let signer;
let currentAccount = null;

let usdtContract;
let thbcContract;
let exchangeAdmin; // ใช้ ABI ที่มีฟังก์ชัน owner / setRate / withdraw

function $(id) {
  return document.getElementById(id);
}

/**
 * เลือก provider ให้รองรับ Bitget / Bitkeep / MetaMask
 * ลำดับ: Bitget -> Bitkeep -> window.ethereum
 */
function getInjectedProvider() {
  // Bitget
  if (window.bitget && window.bitget.ethereum) {
    return window.bitget.ethereum;
  }

  // Bitkeep
  if (window.bitkeep && window.bitkeep.ethereum) {
    return window.bitkeep.ethereum;
  }

  // MetaMask / อื่น ๆ
  if (window.ethereum) {
    return window.ethereum;
  }

  return null;
}

/* ====================== UI MESSAGE HELPER ===================== */

function setAdminMessage(text, type) {
  const el = $("adminMessage");
  if (!el) return;
  el.textContent = text || "";

  if (type === "success") {
    el.style.color = "#4CAF50";
  } else if (type === "error") {
    el.style.color = "#FF5252";
  } else {
    el.style.color = "#FFFFFF";
  }
}

/* ============================ INIT ============================ */

async function initAdmin() {
  injected = getInjectedProvider();
  if (!injected) {
    console.warn("No injected wallet found (MetaMask / Bitget)");
  }

  if ($("btnConnect")) $("btnConnect").onclick = connectOwnerWallet;
  if ($("btnRefresh")) $("btnRefresh").onclick = loadContractState;
  if ($("btnSetRate")) $("btnSetRate").onclick = onUpdateRate;
  if ($("btnSetReferral")) $("btnSetReferral").onclick = onUpdateReferral;
  if ($("btnWithdrawUSDT")) $("btnWithdrawUSDT").onclick = onWithdrawUSDT;
  if ($("btnWithdrawTHBC")) $("btnWithdrawTHBC").onclick = onWithdrawTHBC;
}

/* ======================= CONNECT OWNER ======================== */

async function connectOwnerWallet() {
  try {
    injected = getInjectedProvider();
    if (!injected) {
      alert("ไม่พบ Wallet (MetaMask / Bitget) ในเบราว์เซอร์");
      return;
    }

    provider = new ethers.providers.Web3Provider(injected, "any");

    const accounts = await injected.request({
      method: "eth_requestAccounts"
    });

    if (!accounts || !accounts.length) {
      alert("ไม่พบบัญชีใน Wallet");
      return;
    }

    currentAccount = accounts[0].toLowerCase();

    const network = await provider.getNetwork();
    if (network.chainId !== 56) {
      alert("กรุณาเลือก BNB Smart Chain (chainId 56) ใน Wallet ก่อน");
      throw new Error("Wrong network: " + network.chainId);
    }

    signer = provider.getSigner();

    const cfg = window.THBC_CONFIG;
    usdtContract = new ethers.Contract(cfg.usdt.address, cfg.usdt.abi, signer);
    thbcContract = new ethers.Contract(cfg.thbc.address, cfg.thbc.abi, signer);

    // ใช้ ABI สำหรับ admin ด้วย
    const EXCHANGE_ADMIN_ABI = [
      "function owner() view returns (address)",
      "function thbcPerUsdt() view returns (uint256)",
      "function setThbcPerUsdt(uint256 _thbcPerUsdt) external",
      "function getReferralRates() view returns (uint256 level1Bps, uint256 level2Bps, uint256 level3Bps)",
      "function setReferralRates(uint256 _ref1, uint256 _ref2, uint256 _ref3) external",
      "function withdrawUSDT(uint256 amount) external",
      "function withdrawToken(address token, uint256 amount) external"
    ];

    exchangeAdmin = new ethers.Contract(
      cfg.exchange.address,
      EXCHANGE_ADMIN_ABI,
      signer
    );

    if ($("btnConnect")) {
      const short =
        currentAccount.slice(0, 6) +
        "..." +
        currentAccount.slice(currentAccount.length - 4);
      $("btnConnect").textContent = short;
    }

    // เช็ค owner
    const contractOwner = (await exchangeAdmin.owner()).toLowerCase();
    const ownerStatusEl = $("ownerStatus");

    if (contractOwner !== OWNER_ADDRESS) {
      if (ownerStatusEl) {
        ownerStatusEl.textContent =
          "Warning: Contract owner on-chain is not the configured OWNER_ADDRESS.\n" +
          "On-chain owner: " + contractOwner;
      }
      // แสดง panel ได้เฉพาะถ้า currentAccount == contractOwner
    }

    if (currentAccount !== contractOwner) {
      if (ownerStatusEl) {
        ownerStatusEl.textContent =
          "Connected wallet is not the contract owner.\n" +
          "Connected: " + currentAccount + "\n" +
          "Owner: " + contractOwner;
      }
      // ซ่อน panel
      if ($("adminPanel")) $("adminPanel").style.display = "none";
      return;
    }

    // ถ้าเป็น owner จริง -> แสดง panel
    if ($("adminPanel")) $("adminPanel").style.display = "block";
    if (ownerStatusEl) {
      ownerStatusEl.textContent =
        "Owner connected: " + currentAccount + " (on-chain owner verified)";
    }

    // subscribe event เปลี่ยน account / chain
    if (injected && injected.on) {
      injected.on("accountsChanged", () => window.location.reload());
      injected.on("chainChanged", () => window.location.reload());
    }

    await loadContractState();
  } catch (err) {
    console.error("connectOwnerWallet error:", err);
    alert("เชื่อมต่อกระเป๋าไม่สำเร็จ: " + (err.message || err));
  }
}

/* =================== LOAD BALANCE / RATES ===================== */

async function loadContractState() {
  try {
    const cfg = window.THBC_CONFIG;
    if (!provider || !usdtContract || !thbcContract || !exchangeAdmin) {
      setAdminMessage("Please connect owner wallet first.", "error");
      return;
    }

    const [usdtBal, thbcBal, rateBN, refRates] = await Promise.all([
      usdtContract.balanceOf(cfg.exchange.address),
      thbcContract.balanceOf(cfg.exchange.address),
      exchangeAdmin.thbcPerUsdt(),
      exchangeAdmin.getReferralRates()
    ]);

    if ($("contractUsdtBalance")) {
      $("contractUsdtBalance").textContent =
        ethers.utils.formatUnits(usdtBal, 18);
    }
    if ($("contractThbcBalance")) {
      $("contractThbcBalance").textContent =
        ethers.utils.formatUnits(thbcBal, 18);
    }

    const rateStr = ethers.utils.formatUnits(rateBN, 18); // 35e18 -> "35.0"
    if ($("currentRate")) {
      $("currentRate").textContent = rateStr;
    }
    if ($("newRateInput")) {
      $("newRateInput").value = rateStr;
    }

    const [l1, l2, l3] = refRates; // basis points
    if ($("refL1Input")) $("refL1Input").value = (l1.toNumber() / 100).toString();
    if ($("refL2Input")) $("refL2Input").value = (l2.toNumber() / 100).toString();
    if ($("refL3Input")) $("refL3Input").value = (l3.toNumber() / 100).toString();

    setAdminMessage("State refreshed.", "success");
  } catch (err) {
    console.error("loadContractState error:", err);
    setAdminMessage(
      "Load state failed: " +
        (err.data?.message || err.error?.message || err.message || err),
      "error"
    );
  }
}

/* ======================= UPDATE THBC RATE ====================== */

async function onUpdateRate() {
  try {
    if (!exchangeAdmin) {
      setAdminMessage("Please connect owner wallet first.", "error");
      return;
    }

    const rateStr = $("newRateInput").value.trim();
    if (!rateStr || Number(rateStr) <= 0) {
      alert("กรุณาใส่เรท THBC ต่อ 1 USDT (ตัวอย่าง: 35)");
      return;
    }

    // แปลงเป็น 1e18 เช่น 35 -> 35e18
    const rateBN = ethers.utils.parseUnits(rateStr, 18);

    setAdminMessage("Sending setThbcPerUsdt tx...", "info");
    const tx = await exchangeAdmin.setThbcPerUsdt(rateBN);
    await tx.wait();

    setAdminMessage("Update THBC rate success.", "success");
    await loadContractState();
  } catch (err) {
    console.error("onUpdateRate error:", err);
    setAdminMessage(
      "Update rate failed: " +
        (err.data?.message || err.error?.message || err.message || err),
      "error"
    );
  }
}

/* ==================== UPDATE REFERRAL RATES ==================== */

async function onUpdateReferral() {
  try {
    if (!exchangeAdmin) {
      setAdminMessage("Please connect owner wallet first.", "error");
      return;
    }

    const l1Str = $("refL1Input").value.trim();
    const l2Str = $("refL2Input").value.trim();
    const l3Str = $("refL3Input").value.trim();

    const l1 = parseFloat(l1Str || "0");
    const l2 = parseFloat(l2Str || "0");
    const l3 = parseFloat(l3Str || "0");

    if (l1 < 0 || l2 < 0 || l3 < 0) {
      alert("ค่าคอมต้องไม่ติดลบ");
      return;
    }

    const total = l1 + l2 + l3;
    if (total > 30) {
      alert("รวม % ทั้งสามชั้นต้องไม่เกิน 30%");
      return;
    }

    // แปลงจาก % -> basis points (1% = 100)
    const bps1 = Math.round(l1 * 100);
    const bps2 = Math.round(l2 * 100);
    const bps3 = Math.round(l3 * 100);

    setAdminMessage("Sending setReferralRates tx...", "info");
    const tx = await exchangeAdmin.setReferralRates(bps1, bps2, bps3);
    await tx.wait();

    setAdminMessage("Update referral rates success.", "success");
    await loadContractState();
  } catch (err) {
    console.error("onUpdateReferral error:", err);
    setAdminMessage(
      "Update referral failed: " +
        (err.data?.message || err.error?.message || err.message || err),
      "error"
    );
  }
}

/* ========================== WITHDRAW =========================== */

async function onWithdrawUSDT() {
  try {
    if (!exchangeAdmin) {
      setAdminMessage("Please connect owner wallet first.", "error");
      return;
    }

    const amountStr = $("withdrawUsdtAmount").value.trim();
    if (!amountStr || Number(amountStr) <= 0) {
      alert("กรุณาใส่จำนวน USDT ที่ต้องการถอน");
      return;
    }

    const amountBN = ethers.utils.parseUnits(amountStr, 18);

    setAdminMessage("Sending withdrawUSDT tx...", "info");
    const tx = await exchangeAdmin.withdrawUSDT(amountBN);
    await tx.wait();

    setAdminMessage("Withdraw USDT success.", "success");
    await loadContractState();
  } catch (err) {
    console.error("onWithdrawUSDT error:", err);
    setAdminMessage(
      "Withdraw USDT failed: " +
        (err.data?.message || err.error?.message || err.message || err),
      "error"
    );
  }
}

async function onWithdrawTHBC() {
  try {
    if (!exchangeAdmin) {
      setAdminMessage("Please connect owner wallet first.", "error");
      return;
    }

    const amountStr = $("withdrawThbcAmount").value.trim();
    if (!amountStr || Number(amountStr) <= 0) {
      alert("กรุณาใส่จำนวน THBC ที่ต้องการถอน");
      return;
    }

    const amountBN = ethers.utils.parseUnits(amountStr, 18);
    const cfg = window.THBC_CONFIG;

    setAdminMessage("Sending withdrawToken (THBC) tx...", "info");
    const tx = await exchangeAdmin.withdrawToken(cfg.thbc.address, amountBN);
    await tx.wait();

    setAdminMessage("Withdraw THBC success.", "success");
    await loadContractState();
  } catch (err) {
    console.error("onWithdrawTHBC error:", err);
    setAdminMessage(
      "Withdraw THBC failed: " +
        (err.data?.message || err.error?.message || err.message || err),
      "error"
    );
  }
}

/* ============================ START =========================== */

window.addEventListener("load", initAdmin);
