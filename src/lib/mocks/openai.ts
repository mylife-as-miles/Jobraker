export class OpenAI {
    chat = {
        completions: {
            create: async () => ({
                choices: [{ message: { content: "Mock response" } }],
            }),
        },
    };
}

export default OpenAI;
