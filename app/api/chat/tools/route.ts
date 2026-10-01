import Anthropic from '@anthropic-ai/sdk';

const antrophic = new Anthropic();

export async function POST(req: Request) {
  const { message } = await req.json();

  const tools: Anthropic.Tool[] = [
    {
      name: 'get_current_time',
      description: "Returns the current date and time in the user's timezone",
      input_schema: {
        type: 'object',
        properties: {},
      },
    },
  ];

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: message }];

  const MAX_TURNS = 6;
  let finalText = '';

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await antrophic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      tools,
      messages,
    });
    console.log(
      `Turn ${turn + 1}:`,
      response.stop_reason,
      response.content.map((b) => b.type),
    );

    //if Claude gave a text answer we are done
    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find((b) => b.type === 'text');
      finalText = textBlock && textBlock.type === 'text' ? textBlock.text : '';
      break;
    }

    //Otherwise claude want s to use one or more tools.
    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });

      //Run every tool_use block in this response and collect the results
      const toolResult: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;

        console.log('Executing tool:', block.name, 'with input:', block.input);

        let result: string;
        if (block.name === 'get_current_time') {
          result = new Date().toString();
        } else {
          result = `Unknown tool: ${block.name}`;
        }

        console.log('Tool result:', result);

        toolResult.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        });
      }
      //Send all tool results back in a single user message.
      messages.push({ role: 'user', content: toolResult });
      continue;
    }
    //Anything else (max_token hit, refusal, etc) bail out
    console.log('Unexpected stop_reason:', response.stop_reason);
    break;
  }
  return Response.json({ text: finalText });
}
