const crypto = require('crypto');

export default async function handler(req, res) {
    // --- DEBUG LOGS START ---
    console.log("--- New Proxy Request ---");
    console.log("Method:", req.method);
    console.log("Query Params (from Shopify):", req.query);
    console.log("Body (from Theme):", req.body);
    // --- DEBUG LOGS END ---

    const { signature, ...params } = req.query;
    
    if (!signature) {
        console.error("Error: Signature missing from request query.");
        return res.status(401).json({ error: "Missing Signature" });
    }

    // 1. Verify HMAC Signature
    const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${key}=${params[key]}`)
        .join('');

    const hash = crypto
        .createHmac('sha256', process.env.SHOPIFY_CLIENT_SECRET)
        .update(sortedParams)
        .digest('hex');

    console.log("Calculated Hash:", hash);
    console.log("Shopify Signature:", signature);

    if (hash !== signature) {
        console.error("Signature Mismatch!");
        return res.status(401).json({ 
            error: "Invalid Signature",
            received: signature,
            calculated: hash 
        });
    }

    // 2. Process the Update
    if (req.method === 'POST') {
        try {
            const { customerId, firstName } = req.body;
            console.log(`Updating customer ${customerId} to ${firstName}`);

            const response = await fetch(
                `https://relicv1demo.myshopify.com/admin/api/2024-01/customers/${customerId}.json`, 
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN
                    },
                    body: JSON.stringify({
                        customer: { id: customerId, first_name: firstName }
                    })
                }
            );
            const data = await response.json();
            return res.status(200).json(data);
        } catch (err) {
            console.error("Shopify API Error:", err.message);
            return res.status(500).json({ error: err.message });
        }
    }

    return res.status(200).json({ status: "Success", message: "Proxy signature verified" });
}