const crypto = require('crypto');

export default async function handler(req, res) {
    // 1. Extract query params from the URL (where Shopify puts the signature)
    const url = new URL(req.url, `https://${req.headers.host}`);
    const searchParams = Object.fromEntries(url.searchParams.entries());
    
    const { signature, ...params } = searchParams;
    
    if (!signature) {
        return res.status(401).json({ error: "Missing Signature" });
    }

    // 2. Verify HMAC Signature
    const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${key}=${params[key]}`)
        .join('');

    const hash = crypto
        .createHmac('sha256', process.env.SHOPIFY_CLIENT_SECRET)
        .update(sortedParams)
        .digest('hex');

    if (hash !== signature) {
        return res.status(401).json({ error: "Invalid Signature", debug: "Check your Client Secret" });
    }

    // 3. Handle the POST request from your theme
    if (req.method === 'POST') {
        try {
            const { customerId, firstName, phone } = req.body;
            
            const response = await fetch(
                `https://relicv1demo.myshopify.com/admin/api/2024-01/customers/${customerId}.json`, 
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN
                    },
                    body: JSON.stringify({
                        customer: { id: customerId, first_name: firstName, phone: phone }
                    })
                }
            );
            const data = await response.json();
            return res.status(200).json(data);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    return res.status(200).json({ status: "Proxy Connected" });
}