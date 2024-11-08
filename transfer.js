// transfer.js

const { TonClient, Address, toNano, fromNano } = require('@ton/ton');
const { mnemonicToPrivateKey } = require('@ton/crypto');
const { WalletContractV5 } = require('@ton/wallets');

async function sendTON(fromAddress, toAddress, amount, seedPhrase) {
    try {
        // Inițializare client
        const client = new TonClient({
            endpoint: 'https://toncenter.com/api/v2/jsonRPC',
            apiKey: '5c4f3a11b911bb8898e8155b0360f6521d1bbcb18ca89e710a28981c3932a3e9'
        });

        // Convertim seed phrase în cheie privată
        console.log('Generez cheia din seed phrase...');
        const keyPair = await mnemonicToPrivateKey(seedPhrase.split(' '));

        // Inițializăm contractul portofelului
        const wallet = WalletContractV5.create({
            publicKey: keyPair.publicKey,
            workchain: 0
        });

        // Verificăm că adresa generată coincide cu cea furnizată
        const walletAddress = wallet.address.toString();
        console.log('Adresa generată:', walletAddress);
        if (walletAddress !== fromAddress) {
            throw new Error('Adresa generată din seed phrase nu coincide cu adresa sursei');
        }

        // Verificare sold
        const balance = await client.getBalance(wallet.address);
        const balanceInTON = fromNano(balance);
        console.log('Sold curent:', balanceInTON, 'TON');

        if (Number(balanceInTON) < amount + 0.05) {
            throw new Error(`Sold insuficient. Aveți ${balanceInTON} TON, necesari ${amount + 0.05} TON`);
        }

        // Creăm tranzacția
        const toAddr = Address.parse(toAddress);
        const seqno = await wallet.getSeqno(client);
        const transfer = wallet.createTransfer({
            secretKey: keyPair.secretKey,
            seqno: seqno,
            messages: [
                {
                    address: toAddr,
                    amount: toNano(amount)
                }
            ]
        });

        // Trimitem tranzacția
        console.log('Trimit tranzacția...');
        await client.sendExternalMessage(wallet, transfer);

        // Așteptăm confirmarea
        console.log('Aștept confirmarea...');
        let currentSeqno = seqno;
        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 3000));
            const newSeqno = await wallet.getSeqno(client);
            if (newSeqno > currentSeqno) {
                console.log('Tranzacție confirmată!');
                return {
                    success: true,
                    from: fromAddress,
                    to: toAddress,
                    amount: amount
                };
            }
            console.log(`Încercare ${i + 1}/10: Aștept confirmarea...`);
        }

        throw new Error('Timeout confirmare tranzacție');

    } catch (error) {
        console.error('Eroare la transfer:', error.message);
        throw error;
    }
}

// Configurare
const fromAddress = 'UQBUyHSE_3bUQrwxbTbNlKbSBqvSLN9aL6DBJN8x-qcpDrpZ';
const toAddress = 'UQCCScX-7-W6v-s0l_2nwzd8MKPtvLESDbzbsEKtb7cumL7C';
const amount = 0.01;
const seedPhrase = 'powder crop neutral ritual misery sound dragon honey ugly wash shield boost blue casual high salad wisdom party rely spray embark duck huge nose'; // Înlocuiește cu seed phrase-ul tău

// Rulare transfer
console.log('Începe transferul...');
console.log('De la:', fromAddress);
console.log('Către:', toAddress);
console.log('Suma:', amount, 'TON');

sendTON(fromAddress, toAddress, amount, seedPhrase)
    .then(result => {
        console.log('\nTransfer completat cu succes!');
        console.log(result);
    })
    .catch(error => {
        console.error('\nEroare:', error.message);
        process.exit(1);
    });
