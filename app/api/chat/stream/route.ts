import Anthropic from "@anthropic-ai/sdk";
import { COOK_SYSTEM_PROMPT_V1 } from '@/lib/prompts';

const anthropic = new Anthropic();

export async function POST(req: Request) {
    const {message} =  await req.json();

    const stream = await anthropic.messages.stream({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: COOK_SYSTEM_PROMPT_V1,
        messages: [{ role: 'user', content: message }],
    });

    const enccoder = new TextEncoder();

    const readable = new ReadableStream({
        async start(controller){
            for await (const event of stream){
                if (
                    event.type === 'content_block_delta' &&
                    event.delta.type === 'text_delta'
                ){
                    controller.enqueue(enccoder.encode(event.delta.text))
                }
            }
            controller.close();
        }
    })
    return new Response( readable, {
        headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        },
    })
}