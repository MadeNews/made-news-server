const axios = require('axios');
require('dotenv').config();

const generateSatireStory = async (title) => {
    const prompt = `You're MadeNewsBot, a fake news anchor. Write a 3-paragraph satirical article titled: "${title}". The tone should be absurd, funny, and in the style of The Onion or ClickHole. Present it like a real news story.`;

    try {
        const result = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: "llama3-70b-8192",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.8,
                max_tokens: 300
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': "application/json"
                }
            }
        );

        const content = result.data.choices[0].message.content.trim();
        const paragraphs = content.split(/\n\s*\n/);

        return {
            title,
            content,
            paragraphs,
            createdAt: new Date().toISOString()
        };

    } catch (error) {
        console.error('Failed to generate satire:', error.message);
        return {
            error: true,
            message: "We're having technical difficulties generating this story. Please try again later."
        };
    }
};

const generateRandomStory = async () => {
    const prompt = `You're MadeNewsBot, an absurd, satirical news anchor for a fake news outlet. Invent a completely fictional and ridiculous headline that sounds like it belongs on The Onion or ClickHole. Then write a 3-paragraph fake news article based on that headline. Make the tone exaggerated, witty, and surreal — filled with over-the-top quotes, bizarre logic, and mock-serious reporting. Treat the nonsense as world-shattering news. End with a punchy or ironic twist.`;

    try {
        const result = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: "llama3-70b-8192",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.8,
                max_tokens: 300
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': "application/json"
                }
            }
        );

        const content = result.data.choices[0].message.content.trim();
        const titleMatch = content.match(/^(.*?)(?=\n|$)/);
        const title = titleMatch ? titleMatch[1].replace(/\*\*/g, '').trim() : "Untitled";
        const paragraphs = content.split(/\n\s*\n/);

        return {
            title,
            content,
            paragraphs,
            createdAt: new Date().toISOString()
        };

    } catch (error) {
        console.error('Failed to generate satire:', error.message);
        return {
            error: true,
            message: "We're having technical difficulties generating this story. Please try again later."
        };
    }
};

module.exports = { generateSatireStory, generateRandomStory };
