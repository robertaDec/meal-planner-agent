import Anthropic from "@anthropic-ai/sdk";

const antrophic = new Anthropic();

export async function POST(req: Request){
    const {message} = await req.json();
    const tools: Anthropic.Tool[] = [
        {
            name: 'get_current_time',
            description: "Returns the current date and time in the user's timezone",
            input_schema: {
                type: 'object',
                properties: {},
            }
        }
    ]
    const firstResponse = await antrophic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        tools,
        messages: [{role: 'user', content: message}],
    })

    console.log("Turn one response:", JSON.stringify(firstResponse, null, 2));

    if(firstResponse.stop_reason !== 'tool_use'){
        const text = firstResponse.content[0].type === 'text' ? firstResponse.content[0].text : '';
        return Response.json({text});
    }

    const toolUseBlock = firstResponse.content.find((b) => b.type === 'tool_use');
    if(!toolUseBlock || toolUseBlock.type !== 'tool_use'){
        return Response.json({test: "No tool use block found, unexpected"});
    }

    console.log('Claude asked to call:', toolUseBlock.name, 'with input:', toolUseBlock.input )

    let toolResult: string;

    if(toolUseBlock.name === 'get_current_time'){
        toolResult = new Date().toString();
    } else {
        toolResult = `Unknown tool: ${toolUseBlock.name}`;
    }
    console.log('Tool result', toolResult)

    const secondResoponse = await antrophic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        tools,
        messages: [
            { role: 'user', content: message },
            { role: 'assistant', content: firstResponse.content },
            {
                role: 'user',
                content: [
                    {
                        type: 'tool_result',
                        tool_use_id: toolUseBlock.id,
                        content: toolResult,
                    }
                ]
            }
        ]
    });
    console.log('Turn 2 response', JSON.stringify(secondResoponse, null, 2));

    const finalText = secondResoponse.content[0].type === 'text' ? secondResoponse.content[0].text : '';
    return Response.json({text: finalText});
}