// api/verificar-ltc.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const { txHash, montoEsperadoUSD } = req.body;
    const MI_BILLETERA_LTC = 'ltc1qg6auul6f2mwtjq58ywurt8mdfqnggmlzhxgw3d';

    if (!txHash) {
        return res.status(400).json({ error: 'Falta el Hash (ID) de la transacción' });
    }

    try {
        // 1. Buscar transacción en Blockchair
        const blockchairResponse = await fetch(`https://api.blockchair.com/litecoin/dashboards/transaction/${txHash}`);
        const data = await blockchairResponse.json();

        if (!data.data || Object.keys(data.data).length === 0) {
            return res.status(404).json({ error: 'Transacción no encontrada en la red de Litecoin.' });
        }

        const transaccion = data.data[txHash];
        let pagoDetectado = false;
        let montoLTCRecibido = 0;

        // 2. Verificar si tu billetera recibió el dinero
        for (const output of transaccion.outputs) {
            if (output.recipient === MI_BILLETERA_LTC) {
                pagoDetectado = true;
                montoLTCRecibido = output.value / 100000000; // Convertir Satoshis a LTC
                break;
            }
        }

        if (!pagoDetectado) {
            return res.status(400).json({ error: 'La transacción existe, pero el dinero NO fue enviado a tu billetera.' });
        }

        // 3. Consultar precio actual del LTC en USD
        const precioLTC = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=litecoin&vs_currencies=usd');
        const precioData = await precioLTC.json();
        const valorPagadoEnUSD = montoLTCRecibido * precioData.litecoin.usd;

        // 4. Validar que el monto pagado sea correcto (con margen de $0.50 por volatilidad)
        if (valorPagadoEnUSD < (montoEsperadoUSD - 0.50)) {
            return res.status(400).json({ 
                error: `Pago incompleto. Se detectaron ~$${valorPagadoEnUSD.toFixed(2)} USD, pero se esperaban $${montoEsperadoUSD}.` 
            });
        }

        return res.status(200).json({ 
            success: true, 
            mensaje: 'Pago verificado criptográficamente.',
            montoPagado: valorPagadoEnUSD
        });

    } catch (error) {
        console.error("Error al verificar LTC:", error);
        return res.status(500).json({ error: 'Error interno al conectar con la Blockchain.' });
    }
}
