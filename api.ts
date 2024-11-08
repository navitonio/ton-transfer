//@ts-nocheck
import express from "express";
import { getHttpEndpoint } from "@orbs-network/ton-access";
import { mnemonicToWalletKey } from "@ton/crypto";
import { TonClient, WalletContractV5R1, internal, SendMode } from "@ton/ton";

const app = express();
app.use(express.json());

// TON Wallet setup
const mnemonic = "powder crop neutral ritual misery sound dragon honey ugly wash shield boost blue casual high salad wisdom party rely spray embark duck huge nose";
let walletContract: any;
let client: TonClient;

// Initialize TON client and wallet
async function initializeWallet() {
    const key = await mnemonicToWalletKey(mnemonic.split(" "));
    const wallet = WalletContractV5R1.create({ publicKey: key.publicKey, workchain: 0 });
    const endpoint = await getHttpEndpoint({ network: "mainnet" });
    client = new TonClient({ endpoint });
    walletContract = client.open(wallet);

    // Check if wallet is deployed
    if (!await client.isContractDeployed(wallet.address)) {
        console.log("wallet is not deployed");
        process.exit(1);
    }
}

// Endpoint to send TON transaction
app.post("/send-ton", async (req, res) => {
    const { to, value, message } = req.body;

    // Check for missing fields
    if (!to || !value || !message) {
        return res.status(400).json({ error: "Missing 'to', 'value', or 'message' field" });
    }

    try {
        // Check balance
        const balance = await client.getBalance(walletContract.address);
        if (balance < parseFloat(value)) {
            return res.status(400).json({ error: "Insufficient balance" });
        }

        // Send transaction
        const seqno = await walletContract.getSeqno();
        const transaction = await walletContract.sendTransfer({
            secretKey: (await mnemonicToWalletKey(mnemonic.split(" "))).secretKey,
            seqno: seqno,
            messages: [
                internal({
                    to: to,
                    value: value.toString(), // Amount in TON
                    body: message, // Message body
                    bounce: false,
                })
            ],
            sendMode: SendMode.PAY_GAS_SEPARATELY,
        });

        // Wait for transaction confirmation
        let currentSeqno = seqno;
        while (currentSeqno === seqno) {
            console.log("waiting for transaction to confirm...");
            await sleep(1500);
            currentSeqno = await walletContract.getSeqno();
        }

        // Transaction link (replace with preferred explorer)
        const transactionLink = `https://tonscan.org/address/${walletContract.address.toString()}`;

        return res.json({
            status: "Transaction confirmed!",
            transactionLink: transactionLink
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Transaction failed", details: error.message });
    }
});

// Helper function to sleep
function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Start the server
const PORT = process.env.PORT || 3003;
initializeWallet().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}).catch(error => {
    console.error("Failed to initialize wallet:", error);
});
