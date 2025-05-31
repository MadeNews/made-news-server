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
        return result.data.choices[0].message.content;
    } catch (error) {
        console.error('Failed to generate satire:', error.message);
        return "We're having technical difficulties generating this story. Please try again later.";
    }
};
