
const axios = require('axios');
require('dotenv').config();


const generateSatireStory = async (title) => {
    const prompt = `Write a 3-paragraph satirical news article titled: "${title}". Keep it satirical, funny, and in news format.`

    const result = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
            model: "llama3-70b-8192",
            messages: [{
                role:"user",
                content: prompt
            }],
            temperature: 0.8,
            max_tokens : 300
        },
        {
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': "application/json"
            }
        }
    );

    return result.data.choices[0].message.content
}
module.exports = generateSatireStory