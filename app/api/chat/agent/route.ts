import Anthropic from '@anthropic-ai/sdk';
import { COOK_SYSTEM_PROMPT_V1 } from '@/lib/prompts';

const anthropic = new Anthropic();

const tools: Anthropic.Tool[] = [
  {
    name: 'get_current_time',
    description:
      "Return the current date and time in the user's timezone. Use this whenever the answer depends on knowing today's date, the dayof the week, or the time of the day",
    input_schema: { type: 'object', properties: {} },
  },
];

export async function POST(req: Request) {
  const { message } = await req.json();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        const messages: Anthropic.MessageParam[] = [{ role: 'user', content: message }];

        const MAX_TURNS = 6;

        for (let turn = 0; turn < MAX_TURNS; turn++) {
          const modelStream = await anthropic.messages.stream({
            model: 'claude-sonnet-4-5',
            max_tokens: 1024,
            system: COOK_SYSTEM_PROMPT_V1,
            tools,
            messages,
          });

          for await (const event of modelStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              send({ type: 'text', delta: event.delta.text });
            }
          }
          const finalResponse = await modelStream.finalMessage();

          console.log(
            `Turn ${turn + 1}:`,
            finalResponse.stop_reason,
            finalResponse.content.map((b) => b.type),
          );

          if (finalResponse.stop_reason !== 'tool_use') {
            send({ type: 'done' });
            break;
          }

          messages.push({ role: 'assistant', content: finalResponse.content });

          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const block of finalResponse.content) {
            if (block.type !== 'tool_use') continue;

            send({ type: 'tool_start', name: block.name, input: block.input });

            let result: string;
            if (block.name === 'get_current_time') {
              result = new Date().toString();
            } else {
              result = `Unknown tool: ${block.name}`;
            }

            send({
              type: 'tool_result',
              name: block.name,
              summary: result.slice(0, 100),
            });

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result,
            });
          }
          messages.push({ role: 'user', content: toolResults });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        send({ type: 'error', message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
