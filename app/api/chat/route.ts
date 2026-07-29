import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(req: Request) {
    const { message } = await req.json();

    const  response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        messages: [{role: 'user', content: message}],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    return Response.json(text);
}