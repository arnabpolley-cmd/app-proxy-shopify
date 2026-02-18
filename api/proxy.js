const crypto = require('crypto');

export default async function handler(req, res) {
    const { signature, ...params } = req.query;
    
    if (!signature) return res.status(401).json({ error: "Missing Signature" });

    // 1. Verify HMAC Signature
    const sortedParams = Object.keys(params).sort()
        .map(key => `${key}=${params[key]}`).join('');

    const hash = crypto.createHmac('sha256', process.env.SHOPIFY_CLIENT_SECRET)
        .update(sortedParams).digest('hex');

    if (hash !== signature) return res.status(401).json({ error: "Invalid Signature" });

    if (req.method === 'POST') {
        try {
            let { customerId, firstName } = req.body;

            // FIX: Remove 'gid://shopify/Customer/' if it exists
            if (customerId.includes('Customer/')) {
                customerId = customerId.split('Customer/').pop();
            }

            // 2. Get the Admin Access Token
            const tokenResponse = await fetch(`https://relicv1demo.myshopify.com/admin/oauth/access_token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: process.env.SHOPIFY_CLIENT_ID,
                    client_secret: process.env.SHOPIFY_CLIENT_SECRET,
                    grant_type: 'client_credentials'
                })
            });

            const tokenData = await tokenResponse.json();
            const adminToken = tokenData.access_token;

            if (!adminToken) return res.status(500).json({ error: "Token generation failed" });

            // 3. Update the customer
            const updateResponse = await fetch(
                `https://relicv1demo.myshopify.com/admin/api/2024-01/customers/${customerId}.json`, 
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Shopify-Access-Token': adminToken
                    },
                    body: JSON.stringify({
                        customer: { id: customerId, first_name: firstName }
                    })
                }
            );

            const data = await updateResponse.json();

            // LOGGING: This helps you see the REAL error in Vercel logs
            console.log("Shopify Response:", JSON.stringify(data));

            if (updateResponse.ok) {
                return res.status(200).json(data);
            } else {
                return res.status(updateResponse.status).json({ error: "Shopify Update Failed", details: data });
            }

        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
    return res.status(200).json({ status: "Success" });
}