const fs = require('fs')
const generateSatireStory = require('./llama')
const categories = require("./categories.json")

const generateAll = async () => {

    const categorizedArticles = {}

    for (const categoryObject of categories) {
        const articles = []

        for(i=0;i<5;i++) {
            const result = await generateSatireStory(categoryObject.prompt)  
            articles.push({
                title: result.split('\n').find(line => line.trim() !== '') || 'Untitled',
                content: result,
                createdAt: new Date().toISOString(),
                category: categoryObject.category
            })  
        }

        categorizedArticles[categoryObject.category] = articles
    }

    fs.writeFileSync(
        './articles.json',
        JSON.stringify({
        updatedAt: new Date().toISOString(),
        articles: categorizedArticles
        }, null, 2)
    );

    console.log("Articles Updated Successfully!")
}

module.exports = generateAll;