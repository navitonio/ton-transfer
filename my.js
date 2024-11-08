import { mnemonicToWalletKey } from "@ton/crypto";
import { WalletContractV4 } from "@ton/ton";

async function main() {
    // open wallet v4 (notice the correct wallet version here)
    const mnemonic = "powder crop neutral ritual misery sound dragon honey ugly wash shield boost blue casual high salad wisdom party rely spray embark duck huge nose"; // your 24 secret words (replace ... with the rest of the words)
    const key = await mnemonicToWalletKey(mnemonic.split(" "));
    const wallet = WalletContractV4.create({ publicKey: key.publicKey, workchain: 0 });

    // print wallet address
    console.log(wallet.address.toString({ testOnly: true }));

    // print wallet workchain
    console.log("workchain:", wallet.address.workChain);
}

main();
