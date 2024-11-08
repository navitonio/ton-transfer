//@ts-nocheck
import express from "express";
import { getHttpEndpoint } from "@orbs-network/ton-access";
import { mnemonicToWalletKey } from "@ton/crypto";
import { TonClient, WalletContractV5R1, internal, SendMode } from "@ton/ton";

const app = express();
app.use(express.json());

// Configurație
const API_KEY = process.env.API_KEY || "O8EJDlNS8Abx03JWnx9cMH682X084dv1TTmT7BER2uTQBZbwapeCgPWHxcaRSopIOv1BeoosMCJfH2nnAKwV5j3GyGycp0LdaPBcujahpb3EEWMzci0c7IEpZdEzzPMf";
const mnemonic = "powder crop neutral ritual misery sound dragon honey ugly wash shield boost blue casual high salad wisdom party rely spray embark duck huge nose";
let walletContract: any;
let client: TonClient;

// Middleware pentru verificarea API key-ului
const authenticateApiKey = (req: express.Request, res: express.Response, next: express.Function) => {
    const apiKey = req.header('X-API-Key');

    if (!apiKey || apiKey !== API_KEY) {
        return res.status(401).json({
            error: "Unauthorized - Invalid API Key"
        });
    }

    next();
};

// Initialize TON client and wallet
async function initializeWallet() {
    const key = await mnemonicToWalletKey(mnemonic.split(" "));
    const wallet = WalletContractV5R1.create({ publicKey: key.publicKey, workchain: 0 });
    const endpoint = await getHttpEndpoint({ network: "mainnet" });
    client = new TonClient({ endpoint });
    walletContract = client.open(wallet);

    if (!await client.isContractDeployed(wallet.address)) {
        console.log("wallet is not deployed");
        process.exit(1);
    }
}

// Aplicăm middleware-ul de autentificare pentru ruta /send-ton
app.post("/send-ton", authenticateApiKey, async (req, res) => {
    const { to, value, message } = req.body;

    if (!to || !value || !message) {
        return res.status(400).json({ error: "Missing 'to', 'value', or 'message' field" });
    }

    try {
        const balance = await client.getBalance(walletContract.address);
        if (balance < parseFloat(value)) {
            return res.status(400).json({ error: "Insufficient balance" });
        }

        const seqno = await walletContract.getSeqno();
        const transaction = await walletContract.sendTransfer({
            secretKey: (await mnemonicToWalletKey(mnemonic.split(" "))).secretKey,
            seqno: seqno,
            messages: [
                internal({
                    to: to,
                    value: value.toString(),
                    body: message,
                    bounce: false,
                })
            ],
            sendMode: SendMode.PAY_GAS_SEPARATELY,
        });

        let currentSeqno = seqno;
        while (currentSeqno === seqno) {
            console.log("waiting for transaction to confirm...");
            await sleep(1500);
            currentSeqno = await walletContract.getSeqno();
        }

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


function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const PORT = process.env.PORT || 3000;
initializeWallet().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        // console.log(`Make sure to include 'X-API-Key' header in your requests`);
    });
}).catch(error => {
    console.error("Failed to initialize wallet:", error);
});
