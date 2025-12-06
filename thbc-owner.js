// thbc-owner.js – THBC Mint / Burn Owner Panel

let provider, signer, thbcRead, thbcWrite;
let currentAccount = null;
let thbcDecimals = 18;

function $(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const el = $(id);
  if (!el) return;
  el.textContent = value;
}

function setMsg(text, type) {
  const el = $("txMessage");
  if (!el) return;
  el.textContent = text || "";

  // type: "success" | "error" | "info"
  if (type === "success") {
    el.style.color = "#4CAF50";
  } else if (type === "error") {
    el.style.color = "#FF5252";
  } else {
    el.style.color = "#FFFFFF";
  }
}

function shortAddress(addr) {
  if (!addr) return "-";
  return addr.slice(0, 6) + "..." + addr.slice(addr.length - 4);
}

// เลือก provider รองรับ MetaMask / Binance / Bitget
function getInjectedProvider() {
  if (window.bitget && window.bitget.ethereum) return window.bitget.ethereum;
  if (window.BinanceChain) return window.BinanceChain;
  if (window.ethereum) return window.ethereum;
  return null;
}

// ---------------- CONNECT WALLET ----------------

async function connectWallet() {
  try {
    const injected = getInjectedProvider();
    if (!injected) {
      alert("ไม่พบ Web3 Wallet (MetaMask / Binance / Bitget)");
      return;
    }

    provider = new ethers.providers.Web3Provider(injected, "any");
    const accounts = await provider.send("eth_requestAccounts", []);
    if (!accounts || accounts.length === 0) {
      alert("ไม่พบบัญชีในกระเป๋า");
      return;
    }

    currentAccount = accounts[0];
    signer = provider.getSigner();

    const net = await provider.getNetwork();
    const cfg = window.THBC_OWNER_CONFIG;

    if (net.chainId !== cfg.chainId) {
      alert(
        `ตอนนี้คุณอยู่บน chainId ${net.chainId}\n` +
        `กรุณาเปลี่ยนเครือข่ายเป็น BNB Smart Chain (chainId ${cfg.chainId})`
      );
      return;
    }

    thbcRead = new ethers.Contract(
      cfg.token.address,
      cfg.token.abi,
      provider
    );

    thbcWrite = new ethers.Contract(
      cfg.token.address,
      cfg.token.abi,
      signer
    );

    // เช็ค owner
    const ownerOnchain = await thbcRead.owner();
    if (ownerOnchain.toLowerCase() !== currentAccount.toLowerCase()) {
      setText("ownerStatus", "Not Owner ❌");
      setMsg("คุณไม่ใช่ Owner ของสัญญา THBC นี้", "error");
      return;
    }

    // อ่าน decimals, name, symbol
    thbcDecimals = await thbcRead.decimals();
    const name = await thbcRead.name();
    const symbol = await thbcRead.symbol();

    setText("ownerStatus", `Connected as Owner ✓  (${shortAddress(currentAccount)})`);
    setText("tokenName", `${name} (${symbol})`);

    setMsg("", "info");

    // subscribe event เปลี่ยนบัญชี / chain
    if (injected && injected.on) {
      injected.on("accountsChanged", () => window.location.reload());
      injected.on("chainChanged", () => window.location.reload());
    }

    await refreshInfo();
  } catch (err) {
    console.error("connectWallet error:", err);
    setMsg("Connect failed: " + (err.message || err), "error");
  }
}

// ---------------- REFRESH INFO ----------------

async function refreshInfo() {
  try {
    if (!thbcRead || !currentAccount) return;

    const [totalSupplyBN, ownerBalBN] = await Promise.all([
      thbcRead.totalSupply(),
      thbcRead.balanceOf(currentAccount)
    ]);

    const totalSupplyStr = ethers.utils.formatUnits(totalSupplyBN, thbcDecimals);
    const ownerBalStr = ethers.utils.formatUnits(ownerBalBN, thbcDecimals);

    setText("totalSupply", totalSupplyStr);
    setText("ownerBalance", ownerBalStr);
  } catch (err) {
    console.error("refreshInfo error:", err);
    setMsg("Refresh data error: " + (err.message || err), "error");
  }
}

// ---------------- MINT ----------------

async function onMint() {
  try {
    setMsg("", "info");

    if (!thbcWrite || !currentAccount) {
      await connectWallet();
      if (!thbcWrite || !currentAccount) return;
    }

    const toInput = $("mintTo");
    const amtInput = $("mintAmount");
    if (!toInput || !amtInput) return;

    let to = toInput.value.trim();
    const amtStr = amtInput.value.trim();

    if (!amtStr) {
      alert("กรุณาใส่จำนวน THBC ที่ต้องการ mint");
      return;
    }

    if (!to) {
      // ถ้าไม่กรอกที่อยู่ ให้ default เป็น owner เอง
      to = currentAccount;
    }

    if (!ethers.utils.isAddress(to)) {
      alert("ที่อยู่กระเป๋า (mint to) ไม่ถูกต้อง");
      return;
    }

    const amountBN = ethers.utils.parseUnits(amtStr, thbcDecimals);

    setMsg("Sending mint transaction...", "info");

    const tx = await thbcWrite.mint(to, amountBN);
    if (!tx || !tx.hash) {
      throw new Error("Wallet did not return transaction object");
    }

    await tx.wait();

    setMsg("Mint THBC success ✅", "success");
    await refreshInfo();
  } catch (err) {
    console.error("mint error:", err);
    setMsg(
      "Mint failed: " +
        (err.data?.message ||
          err.error?.message ||
          err.reason ||
          err.message ||
          err),
      "error"
    );
  }
}

// ---------------- BURN ----------------

async function onBurn() {
  try {
    setMsg("", "info");

    if (!thbcWrite || !currentAccount) {
      await connectWallet();
      if (!thbcWrite || !currentAccount) return;
    }

    const burnInput = $("burnAmount");
    if (!burnInput) return;

    const amtStr = burnInput.value.trim();
    if (!amtStr) {
      alert("กรุณาใส่จำนวน THBC ที่ต้องการ burn");
      return;
    }

    const amountBN = ethers.utils.parseUnits(amtStr, thbcDecimals);

    setMsg("Sending burn transaction...", "info");

    const tx = await thbcWrite.burn(amountBN);
    if (!tx || !tx.hash) {
      throw new Error("Wallet did not return transaction object");
    }

    await tx.wait();

    setMsg("Burn THBC success ✅", "success");
    await refreshInfo();
  } catch (err) {
    console.error("burn error:", err);
    setMsg(
      "Burn failed: " +
        (err.data?.message ||
          err.error?.message ||
          err.reason ||
          err.message ||
          err),
      "error"
    );
  }
}

// ---------------- INIT ----------------

function initOwnerPage() {
  const btnConnect = $("btnConnect");
  const btnMint = $("btnMint");
  const btnBurn = $("btnBurn");

  if (btnConnect) btnConnect.onclick = connectWallet;
  if (btnMint) btnMint.onclick = onMint;
  if (btnBurn) btnBurn.onclick = onBurn;
}

window.addEventListener("load", initOwnerPage);
