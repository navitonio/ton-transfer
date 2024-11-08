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

// Stocăm tranzacțiile în memorie (pentru demo - într-o aplicație reală ai folosi o bază de date)
const transactions = new Map();

const authenticateApiKey = (req: express.Request, res: express.Response, next: express.Function) => {
    const apiKey = req.header('X-API-Key');
    if (!apiKey || apiKey !== API_KEY) {
        return res.status(401).json({ error: "Unauthorized - Invalid API Key" });
    }
    next();
};

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

// Funcție pentru monitorizarea tranzacției în background
async function monitorTransaction(seqno: number, txId: string) {
    try {
        let currentSeqno = seqno;
        let attempts = 0;
        const maxAttempts = 20; // Limităm numărul de încercări

        while (currentSeqno === seqno && attempts < maxAttempts) {
            await sleep(1000); // Reducem timpul de așteptare între verificări
            currentSeqno = await walletContract.getSeqno();
            attempts++;
        }

        if (attempts < maxAttempts) {
            transactions.set(txId, {
                status: "confirmed",
                timestamp: Date.now()
            });
        } else {
            transactions.set(txId, {
                status: "timeout",
                timestamp: Date.now()
            });
        }
    } catch (error) {
        transactions.set(txId, {
            status: "failed",
            error: error.message,
            timestamp: Date.now()
        });
    }
}

app.post("/send-ton", authenticateApiKey, async (req, res) => {
    const { to, value, message } = req.body;

    if (!to || !value || !message) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const balance = await client.getBalance(walletContract.address);
        if (balance < parseFloat(value)) {
            return res.status(400).json({ error: "Insufficient balance" });
        }

        const seqno = await walletContract.getSeqno();
        const txId = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Inițiem tranzacția
        walletContract.sendTransfer({
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
        }).then(() => {
            // Pornim monitorizarea în background
            monitorTransaction(seqno, txId);
        }).catch((error) => {
            transactions.set(txId, {
                status: "failed",
                error: error.message,
                timestamp: Date.now()
            });
        });

        // Returnăm imediat răspunsul cu ID-ul tranzacției
        const transactionLink = `https://tonscan.org/address/${walletContract.address.toString()}`;
        return res.json({
            status: 'success',
            txId: txId,
            transactionLink: transactionLink
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Transaction failed", details: error.message });
    }
});

// Endpoint nou pentru verificarea stării tranzacției
app.get("/transaction-status/:txId", authenticateApiKey, (req, res) => {
    const { txId } = req.params;
    const transaction = transactions.get(txId);

    if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
    }

    return res.json(transaction);
});

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const PORT = process.env.PORT || 3000;
initializeWallet().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}).catch(error => {
    console.error("Failed to initialize wallet:", error);
});
