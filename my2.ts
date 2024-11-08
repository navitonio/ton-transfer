import { getHttpEndpoint } from "@orbs-network/ton-access";
import { mnemonicToWalletKey } from "@ton/crypto";
import { TonClient, WalletContractV5R1, internal, SendMode } from "@ton/ton";

async function main() {
    // open wallet v5R1
    const mnemonic = "powder crop neutral ritual misery sound dragon honey ugly wash shield boost blue casual high salad wisdom party rely spray embark duck huge nose";
    const key = await mnemonicToWalletKey(mnemonic.split(" "));
    const wallet = WalletContractV5R1.create({ publicKey: key.publicKey, workchain: 0 });

    // initialize ton rpc client on mainnet
    const endpoint = await getHttpEndpoint({ network: "mainnet" });
    const client = new TonClient({ endpoint });

    // make sure wallet is deployed
    if (!await client.isContractDeployed(wallet.address)) {
        return console.log("wallet is not deployed");
    }

    // send 0.05 TON to the target address
    const walletContract = client.open(wallet);
    const seqno = await walletContract.getSeqno();
    await walletContract.sendTransfer({
        secretKey: key.secretKey,
        seqno: seqno,
        messages: [
            internal({
                to: "UQBUyHSE_3bUQrwxbTbNlKbSBqvSLN9aL6DBJN8x-qcpDrpZ",
                value: "0.01", // 0.05 TON
                body: "test", // optional comment
                bounce: false,
            })
        ],
        sendMode: SendMode.PAY_GAS_SEPARATELY, // specify the send mode here
    });

    // wait until confirmed
    let currentSeqno = seqno;
    while (currentSeqno == seqno) {
        console.log("waiting for transaction to confirm...");
        await sleep(1500);
        currentSeqno = await walletContract.getSeqno();
    }
    console.log("transaction confirmed!");
}

main();

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
